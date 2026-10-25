import 'dotenv/config';
import express from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import rateLimit from 'express-rate-limit';
import { Booking, ALL_TIME_SLOTS, PHOTOSHOOT_CATEGORIES, isSameOrMatchingSlot } from './src/types/booking.js';
import { bookingEndsAt, finishElapsedBookings, isActiveBooking } from './src/utils/attendance.js';
import { cleanDeviceId, cleanTokens, findActiveDuplicate, normalizePhone, ownsBooking, publicBooking, sameSecret, visitorDevice } from './server/identity.js';
import { StudioBackups, readStudioBlocks, validStudioDate, type StudioBlock } from './server/studio.js';
import { checkSlotAdvanceStatus, MIN_ADVANCE_NOTICE_MINUTES } from './src/utils/bookingRules.js';
import { studioRangeSlots } from './src/utils/studioSchedule.js';
import { canClientCancelBooking, CANCELLATION_RULE, CANCELLATION_CLOSED_MESSAGE } from './src/utils/cancellation.js';
import { parseVinetkaGroup } from './server/vinetka.js';
import { toAzInternationalFull } from './src/utils/phoneUtils.js';
import { isWithinBookingWindow, MAX_BOOKING_ADVANCE_DAYS } from './src/utils/bookingWindow.js';
import { LiveConnectionLimit } from './server/liveConnections.js';
import { rotateExposedBookingSecrets } from './server/legacySecrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production' || (!process.env.NODE_ENV && process.argv[1]?.endsWith('server.js'));
// Nginx forwards requests from the same machine; use the real client IP for quotas.
app.set('trust proxy', process.env.TRUST_PROXY === 'loopback' ? 'loopback' : false);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'" + (isProduction ? '' : " 'unsafe-inline'") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.resolve(DATA_DIR, 'bookings.json');
const LOGO_FILE = path.resolve(DATA_DIR, 'logo.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');
const BLOCKS_FILE = path.resolve(DATA_DIR, 'studio-blocks.json');
let backups: StudioBackups | undefined;
const liveClients = new Set<express.Response>();
const liveConnectionLimit = new LiveConnectionLimit();
let revision = 0;

function publishUpdate() {
  revision++;
  for (const client of liveClients) {
    if (client.writableEnded || client.destroyed) { liveClients.delete(client); continue; }
    // Never queue unlimited events for a slow/disconnected browser.
    if (client.writableLength > 64 * 1024) { client.end(); liveClients.delete(client); continue; }
    client.write('event: update\ndata: ' + JSON.stringify({ revision }) + '\n\n');
  }
}

// General JSON body limit is strictly constrained to 50kb to prevent payload abuse.
// The large limit is only provided specifically on the logo upload route.
const parseLogoUpload = express.json({ limit: '12mb', inflate: false });
app.use('/api/settings/logo', (req, res, next) => {
  if (req.method !== 'POST') return next();
  // Authenticate before accepting/decompressing a large image upload.
  return adminLimiter(req, res, () => requireAdmin(req, res, () => parseLogoUpload(req, res, next)));
});
app.use(express.json({ limit: '50kb', inflate: false }));

// Prevent browser/mobile caching on all API endpoints so updates from any device reflect instantly
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Atomic write helper to prevent file corruption during sudden restarts or concurrent writes
function atomicWriteFileSync(filePath: string, content: string): void {
  backups?.ensureDaily();
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, { encoding: 'utf-8', mode: 0o600, flag: 'wx', flush: true });
    fs.renameSync(tempPath, filePath);
  } finally { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); }
  publishUpdate();
}

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}
if (process.platform !== 'win32') fs.chmodSync(DATA_DIR, 0o700);

// Default settings if settings.json does not exist
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    whatsappNumber: '+994 77 607 97 07',
    studioAddress: 'Hövsan, MİDA 1, Bina 1',
    studioName: 'Emgraphic Studio',
    updatedAt: new Date().toISOString(),
  };
  atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}

// Clean bookings DB initialized as empty array if not present (no fake demo seed blocking real dates)
if (!fs.existsSync(DB_FILE)) {
  atomicWriteFileSync(DB_FILE, JSON.stringify([], null, 2));
}

// Separate from the admin password, so password changes do not invalidate device ownership.
const DEVICE_KEY_FILE = path.join(DATA_DIR, '.device-cookie-key');
if (!fs.existsSync(DEVICE_KEY_FILE)) fs.writeFileSync(DEVICE_KEY_FILE, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
const DEVICE_KEY = fs.readFileSync(DEVICE_KEY_FILE, 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(DEVICE_KEY)) throw new Error('Invalid device cookie signing key.');
if (!fs.existsSync(BLOCKS_FILE)) atomicWriteFileSync(BLOCKS_FILE, '[]');
// Revoke old committed capabilities before the first daily snapshot is made.
readBookings();
backups = new StudioBackups(DATA_DIR, DEVICE_KEY, publishUpdate);
backups.ensureDaily();
setInterval(() => {
  try { backups!.ensureDaily(); } catch (err) { console.error('Daily backup failed:', err); }
}, 60000).unref();

function studioSlotBlocked(date: string, slot: string) {
  return readStudioBlocks(DATA_DIR).some(b => !b.releasedAt && b.date === date && b.timeSlots.some(s => isSameOrMatchingSlot(s, slot)));
}

app.use((req, res, next) => {
  // Issue the cookie with the document too, before its parallel API requests begin.
  if ((req.path === '/api' || req.path.startsWith('/api/')) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && origin !== req.protocol + '://' + req.get('host')) {
      return res.status(403).json({ success: false, error: 'Sorğunun mənbəyinə icazə verilmir.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Düzgün JSON məlumatı göndərin.' });
    }
  }
  res.locals.deviceTokenHash = visitorDevice(req, res, DEVICE_KEY);
  next();
});

// ==========================================
// RATE LIMITERS (Protection against DDoS and automated slot spam)
// ==========================================
const bookingCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Həddindən artıq sayda qeydiyyat cəhdi edildi. Zəhmət olmasa 15 dəqiqə sonra yenidən cəhd edin.',
  },
});

const cancelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Həddindən artıq sayda ləğvetmə cəhdi edildi. Zəhmət olmasa bir qədər sonra cəhd edin.',
  },
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Çox sayda axtarış sorğusu göndərildi. Zəhmət olmasa bir qədər sonra cəhd edin.',
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Həddindən artıq sayda inzibatçı sorğusu göndərildi. Zəhmət olmasa bir qədər sonra cəhd edin.',
  },
});

// Reading every 15 seconds must not consume the quota for admin mutations.
const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çox sayda yeniləmə sorğusu. Bir qədər sonra yenidən yoxlayın.' },
});

// ==========================================
// ADMIN AUTHENTICATION
// Strict comparison against process.env.ADMIN_KEY
// ==========================================
const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
if (!ADMIN_KEY) {
  throw new Error('ADMIN_KEY təyin edilməyib. .env faylında inzibatçı şifrəsini təyin edin.');
}

function isValidAdminKey(adminKey: any): boolean {
  if (!adminKey) return false;
  return typeof adminKey === 'string' && sameSecret(adminKey.trim(), ADMIN_KEY);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isValidAdminKey(req.headers['x-admin-key'])) return res.status(401).json({ success: false, error: 'İcazə verilmədi.' });
  next();
}

app.get('/api/admin/studio-blocks', adminReadLimiter, requireAdmin, (_req, res) => {
  res.json({ success: true, blocks: readStudioBlocks(DATA_DIR) });
});
app.post('/api/admin/studio-blocks', adminLimiter, requireAdmin, (req, res) => {
  const { date, startTime, endTime, reason = 'Vinetka çəkilişi' } = req.body;
  const hasRange = startTime !== undefined || endTime !== undefined;
  const timeSlots = hasRange ? studioRangeSlots(startTime, endTime) : req.body.timeSlots;
  if (hasRange && (!timeSlots || req.body.timeSlots !== undefined)) {
    return res.status(400).json({ success: false, error: 'Başlanğıc və bitiş saatlarını düzgün seçin. Bitiş başlanğıcdan sonra olmalıdır.' });
  }
  if (!validStudioDate(date) || date < getBakuTodayStr() || !Array.isArray(timeSlots) || !timeSlots.length || timeSlots.length > ALL_TIME_SLOTS.length || timeSlots.some(s => typeof s !== 'string' || !ALL_TIME_SLOTS.includes(s)) || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 150) {
    return res.status(400).json({ success: false, error: 'Tarix, saatlar və qısa səbəb düzgün daxil edilməlidir.' });
  }
  let group: ReturnType<typeof parseVinetkaGroup> | undefined;
  if (req.body.group !== undefined) {
    try { group = parseVinetkaGroup(req.body.group); }
    catch (error) { return res.status(400).json({ success: false, error: (error as Error).message }); }
  }
  const blocks = readStudioBlocks(DATA_DIR), bookings = readBookings();
  const selected: string[] = [...new Set<string>(timeSlots)].sort();
  const conflicts = selected.filter(slot => studioSlotBlocked(date, slot) || bookings.some(b => isActiveBooking(b) && b.date === date && isSameOrMatchingSlot(b.timeSlot, slot)));
  if (conflicts.length) return res.status(409).json({ success: false, error: 'Bu saatlar artıq doludur: ' + conflicts.join(', ') + '. Siyahını yeniləyin.' });
  const block: StudioBlock = { id: randomUUID(), date, timeSlots: selected, reason: reason.trim(), createdAt: new Date().toISOString() };
  if (group) block.group = group;
  blocks.push(block);
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(blocks, null, 2));
  res.json({ success: true, block });
});
app.post('/api/admin/studio-blocks/group', adminLimiter, requireAdmin, (req, res) => {
  const blocks = readStudioBlocks(DATA_DIR);
  const block = blocks.find(b => b.id === req.body.id);
  if (!block) return res.status(404).json({ success: false, error: 'Çəkiliş aralığı tapılmadı. Siyahını yeniləyin.' });
  if (req.body.expectedVersion !== (block.updatedAt || block.createdAt)) return res.status(409).json({ success: false, error: 'Bu qeyd artıq dəyişdirilib. Pəncərəni bağlayıb məlumatları yenidən açın.' });
  try { block.group = parseVinetkaGroup(req.body.group); }
  catch (error) { return res.status(400).json({ success: false, error: (error as Error).message }); }
  block.updatedAt = new Date(Math.max(Date.now(), Date.parse(block.updatedAt || block.createdAt) + 1)).toISOString();
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(blocks, null, 2));
  res.json({ success: true, block });
});
app.post('/api/admin/studio-blocks/delete', adminLimiter, requireAdmin, (req, res) => {
  const blocks = readStudioBlocks(DATA_DIR);
  const target = blocks.find(b => b.id === req.body.id);
  if (!target) return res.status(404).json({ success: false, error: 'Bağlanmış saatlar tapılmadı.' });
  if (target.releasedAt) return res.status(409).json({ success: false, error: 'Bu saatlar artıq açılıb. Siyahını yeniləyin.' });
  if (target.group) {
    target.releasedAt = new Date().toISOString();
    target.updatedAt = new Date(Math.max(Date.now(), Date.parse(target.updatedAt || target.createdAt) + 1)).toISOString();
  }
  atomicWriteFileSync(BLOCKS_FILE, JSON.stringify(target.group ? blocks : blocks.filter(b => b.id !== req.body.id), null, 2));
  res.json({ success: true });
});
app.get('/api/admin/backups', adminReadLimiter, requireAdmin, (_req, res) => res.json({ success: true, backups: backups!.list() }));
app.post('/api/admin/backups', adminLimiter, requireAdmin, (_req, res) => res.json({ success: true, backup: backups!.create() }));
app.get('/api/admin/backups/:id/download', adminReadLimiter, requireAdmin, (req, res) => {
  try {
    const content = backups!.download(req.params.id);
    res.set('Content-Disposition', 'attachment; filename="emgraphic-backup-' + req.params.id + '.json"');
    res.type('application/json').send(content);
  } catch { res.status(404).json({ success: false, error: 'Sağlam ehtiyat nüsxə tapılmadı.' }); }
});
app.post('/api/admin/backups/:id/restore', adminLimiter, requireAdmin, (req, res) => {
  if (req.body.confirmId !== req.params.id) return res.status(400).json({ success: false, error: 'Bərpa təsdiqi tələb olunur.' });
  try { res.json({ success: true, backup: backups!.restore(req.params.id) }); }
  catch (err) { console.error('Backup restore failed:', err); res.status(500).json({ success: false, error: 'Nüsxəni bərpa etmək mümkün olmadı. Məlumatlar yoxlanılmalıdır.' }); }
});

// ==========================================
// OFFICIAL BAKU, AZERBAIJAN TIMEZONE (Asia/Baku, UTC+4)
// Azerbaijan is permanently UTC+4 all year round
// ==========================================
const BAKU_TIMEZONE = 'Asia/Baku';

function getBakuNowDetails(baseDate: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BAKU_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10) || baseDate.getFullYear();
  const month = parseInt(getPart('month'), 10) || baseDate.getMonth() + 1;
  const day = parseInt(getPart('day'), 10) || baseDate.getDate();

  let hour = parseInt(getPart('hour'), 10);
  if (hour === 24) hour = 0;

  const minute = parseInt(getPart('minute'), 10) || 0;
  const second = parseInt(getPart('second'), 10) || 0;

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const decimalHour = hour + minute / 60;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    decimalHour,
    timestamp: baseDate.getTime(),
  };
}

function getBakuTodayStr(baseDate?: Date): string {
  return getBakuNowDetails(baseDate).dateStr;
}

// Helper to read bookings from DB
function readBookings(): Booking[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rotated = rotateExposedBookingSecrets(parsed);
        const finished = finishElapsedBookings(parsed);
        if (rotated || finished) writeBookings(parsed);
        return parsed;
      }
      throw new Error('Qeydiyyat faylının formatı düzgün deyil.');
    }
  } catch (err) {
    console.error('Error reading bookings DB:', err);
    throw err;
  }
  return [];
}

// Helper to write bookings to DB atomically
function writeBookings(bookings: Booking[]): void {
  // Let the error handler return 500; never report success for an unsaved booking.
  atomicWriteFileSync(DB_FILE, JSON.stringify(bookings, null, 2));
}

// Runs even with every browser closed; also reconciled on reads after a server restart.
setInterval(() => {
  try { readBookings(); } catch (err) { console.error('Attendance update failed:', err); }
}, 15000).unref();

app.get('/api/events', (req, res) => {
  const release = liveConnectionLimit.acquire(req.ip || req.socket.remoteAddress || 'unknown');
  if (!release) return res.status(429).set('Retry-After', '30').json({ success: false, error: 'Canlı bağlantı həddi dolub. Bir qədər sonra yenidən qoşulun.' });
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  liveClients.add(res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded && res.writableLength < 64 * 1024) res.write(': keep-alive\n\n');
    else res.end();
  }, 20000);
  const lifetime = setTimeout(() => res.end(), 30 * 60 * 1000);
  const cleanup = () => { clearInterval(heartbeat); clearTimeout(lifetime); liveClients.delete(res); release(); };
  res.once('close', cleanup);
  // IncomingMessage 'close' can mean a consumed request, not a closed SSE socket.
  req.once('aborted', cleanup);
  res.once('error', cleanup);
});

// ==========================================
// ANTI-ABUSE & NORMALIZATION HELPERS
// ==========================================
function generateUniqueReferenceCode(existingBookings: Booking[]): string {
  const existingCodes = new Set(existingBookings.map((b) => b.referenceCode));
  let code = '';
  let attempts = 0;
  do {
    attempts++;
    const num = Math.floor(10000 + Math.random() * 90000); // 5 digits (90,000 possibilities)
    code = `EM-${num}`;
    if (attempts > 100) {
      code = `EM-${Date.now().toString().slice(-6)}`;
      break;
    }
  } while (existingCodes.has(code));
  return code;
}

// ==========================================
// ADVANCE BOOKING NOTICE RULE (Çəkilişə ən azı 30 dəqiqə öncədən yazılmaq lazımdır)
// ==========================================
function checkAdvanceNotice(dateStr: string, slotStr: string): { isValid: boolean; error?: string } {
  const advance = checkSlotAdvanceStatus(dateStr, slotStr);
  if (advance.isBookable) return { isValid: true };
  const baku = getBakuNowDetails();
  return {
    isValid: false,
    error: advance.status === 'insufficient_advance'
      ? 'Çəkilişə ən azı ' + MIN_ADVANCE_NOTICE_MINUTES + ' dəqiqə öncədən yazılmaq lazımdır (Cari Bakı vaxtı: ' + baku.timeStr + '). Zəhmət olmasa daha sonrakı saatı seçin.'
      : 'Seçilmiş tarix və saat artıq keçib (Bakı vaxtı ilə). Zəhmət olmasa gələcək vaxt seçin.',
  };
}

// ==========================================
// TIME API
// ==========================================
app.get('/api/time', (_req, res) => {
  const details = getBakuNowDetails();
  res.json({
    timeZone: 'Asia/Baku',
    utcOffset: '+04:00',
    bakuDate: details.dateStr,
    bakuTime: details.timeStr,
    hour: details.hour,
    minute: details.minute,
    second: details.second,
    decimalHour: details.decimalHour,
    timestamp: details.timestamp,
  });
});

// ==========================================
// SETTINGS & LOGO APIS (Protected by isValidAdminKey)
// ==========================================
app.get('/api/settings/logo', (_req, res) => {
  try {
    if (fs.existsSync(LOGO_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOGO_FILE, 'utf-8'));
      return res.json({ logoUrl: data.logoUrl || null });
    }
    return res.json({ logoUrl: null });
  } catch {
    return res.json({ logoUrl: null });
  }
});

// Logo upload accepts up to 10MB data URL but strictly requires admin authorization
app.post('/api/settings/logo', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi. Düzgün admin şifrəsi tələb olunur.' });
  }

  try {
    const { logoUrl } = req.body;
    if (typeof logoUrl !== 'string' || (logoUrl !== '' && !/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoUrl))) {
      return res.status(400).json({ success: false, error: 'Düzgün şəkil faylı təqdim edin.' });
    }
    if (logoUrl !== undefined) {
      atomicWriteFileSync(
        LOGO_FILE,
        JSON.stringify({ logoUrl: logoUrl || null, updatedAt: new Date().toISOString() })
      );
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Loqo məlumatı təqdim olunmayıb.' });
  } catch {
    return res.status(500).json({ error: 'Loqonu saxlamaq mümkün olmadı.' });
  }
});

app.get('/api/settings', (_req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      if (!data || Array.isArray(data) || typeof data.whatsappNumber !== 'string') throw new Error('Invalid settings');
      return res.json({ success: true, settings: data });
    }
    throw new Error('Settings file missing');
  } catch {
    return res.status(500).json({ success: false, error: 'Studiya məlumatlarını oxumaq mümkün olmadı. Yenidən cəhd edin.' });
  }
});

app.post('/api/settings', adminLimiter, (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi. Düzgün admin şifrəsi tələb olunur.' });
  }

  try {
    const { whatsappNumber, studioAddress, studioName } = req.body;
    let current: Record<string, any> = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      if (!current || Array.isArray(current) || typeof current !== 'object') throw new Error('Invalid settings');
    }
    const normalizedWhatsApp = whatsappNumber === undefined ? undefined : normalizePhone(whatsappNumber);
    if (whatsappNumber !== undefined && !normalizedWhatsApp) return res.status(400).json({ success: false, error: 'Düzgün Azərbaycan əlaqə nömrəsi daxil edin.' });
    for (const [value, limit] of [[studioAddress, 300], [studioName, 100]] as const) {
      if (value !== undefined && (typeof value !== 'string' || value.trim().length < 2 || value.length > limit)) return res.status(400).json({ success: false, error: 'Studiya adı və ünvanını düzgün daxil edin.' });
    }
    const updated = {
      ...current,
      ...(normalizedWhatsApp !== undefined ? { whatsappNumber: toAzInternationalFull(normalizedWhatsApp) } : {}),
      ...(studioAddress !== undefined ? { studioAddress: String(studioAddress).trim() } : {}),
      ...(studioName !== undefined ? { studioName: String(studioName).trim() } : {}),
      updatedAt: new Date().toISOString(),
    };
    atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return res.json({ success: true, settings: updated });
  } catch {
    return res.status(500).json({ success: false, error: 'Tənzimləmələri saxlamaq mümkün olmadı.' });
  }
});

// ==========================================
// 1. PUBLIC AVAILABILITY ENDPOINT
// PRIVACY: Only returns { date, timeSlot }
// NO customer names, NO phone numbers, NO private info!
// ==========================================
app.get('/api/availability', (_req, res) => {
  const bookings = readBookings();
  const bookedSlots = bookings
    .filter(isActiveBooking)
    .map((b) => ({
      date: b.date,
      timeSlot: b.timeSlot,
    }));

  const studioSlots = readStudioBlocks(DATA_DIR).filter(b => !b.releasedAt).flatMap(b => b.timeSlots.map(timeSlot => ({ date: b.date, timeSlot })));
  res.json({ success: true, bookedSlots: [...bookedSlots, ...studioSlots] });
});

// ==========================================
// 2. CREATE BOOKING ENDPOINT
// Strict input validation & anti-abuse checks
// ==========================================
function createBooking(req: express.Request, res: express.Response, isAdmin = false) {
  const { clientName, clientPhone, photoshootType, date, timeSlot, notes, deviceId, tokens } = req.body;
  const headerDeviceId = cleanDeviceId(req.headers['x-device-id'] || deviceId);
  const deviceTokenHash = isAdmin ? undefined : res.locals.deviceTokenHash as string;
  const clientIp = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');

  // 1. Input presence check
  if (![clientName, clientPhone, date, timeSlot, photoshootType].every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Zəhmət olmasa bütün tələb olunan xanaları doldurun.',
    });
  }

  // 2. Name validation
  const cleanName = clientName.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (cleanName.length < 2 || cleanName.length > 70) {
    return res.status(400).json({
      success: false,
      error: 'Ad və soyad 2 ilə 70 simvol aralığında olmalıdır.',
    });
  }

  // 3. Phone validation
  const normPhone = normalizePhone(clientPhone);
  if (!normPhone || normPhone.length !== 9) {
    return res.status(400).json({
      success: false,
      error: 'Zəhmət olmasa düzgün Azərbaycan mobil nömrəsi daxil edin (məs: 50 123 45 67).',
    });
  }

  // 4. Date validation (YYYY-MM-DD format & valid calendar date)
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({
      success: false,
      error: 'Tarix formatı düzgün deyil (YYYY-MM-DD tələb olunur).',
    });
  }
  if (!isWithinBookingWindow(date)) return res.status(400).json({ success: false, error: 'Yalnız bu gün və növbəti ' + MAX_BOOKING_ADVANCE_DAYS + ' gün üçün qeydiyyat mümkündür. Uyğun gələcək tarix seçin.' });

  // 5. TimeSlot validation (must be in ALL_TIME_SLOTS)
  if (!ALL_TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({
      success: false,
      error: 'Seçilmiş çəkiliş saatı studiyanın iş qrafikinə uyğun deyil.',
    });
  }

  // 6. Photoshoot type validation
  const cleanType = String(photoshootType).trim();
  if (!PHOTOSHOOT_CATEGORIES.some((category) => category.id === cleanType)) {
    return res.status(400).json({
      success: false,
      error: 'Çəkiliş növü düzgün seçilməyib.',
    });
  }

  // 7. Notes length validation
  const cleanNotes = notes ? String(notes).trim().slice(0, 500) : '';

  const bookings = readBookings();
  const todayStr = getBakuTodayStr();

  // 8. Check Advance Notice Studio Rule (Çəkilişə ən azı 30 dəqiqə öncədən yazılmaq lazımdır)
  const advanceCheck = isAdmin
    ? { isValid: date >= todayStr, error: 'Keçmiş tarixə yeni qeydiyyat əlavə edilə bilməz.' }
    : checkAdvanceNotice(date, timeSlot);
  if (!advanceCheck.isValid) {
    return res.status(400).json({
      success: false,
      error: advanceCheck.error,
    });
  }

  // 9. Check if the specific slot is already booked by another customer
  const isConflict = bookings.some(
    (b) => b.date === date && isSameOrMatchingSlot(b.timeSlot, timeSlot) && isActiveBooking(b)
  );

  if (studioSlotBlocked(date, timeSlot)) {
    return res.status(409).json({ success: false, error: 'Bu saat studiya tərəfindən dolu qeyd edilib. Başqa saat seçin.' });
  }
  if (isConflict) {
    return res.status(409).json({
      success: false,
      error: 'Təəssüf ki, bu saat artıq başqa bir müştəri tərəfindən bron edilib. Zəhmət olmasa başqa saat seçin.',
    });
  }

  // Enforced in the same synchronous read/check/write operation, including manual admin bookings.
  const existingActive = findActiveDuplicate(bookings, {
    clientName: cleanName, clientPhone: normPhone,
    deviceId: isAdmin ? undefined : headerDeviceId,
    deviceTokenHash, tokens: isAdmin ? [] : cleanTokens(tokens),
  });
  if (existingActive) {
    return res.status(409).json({
      success: false,
      errorCode: 'ACTIVE_BOOKING_EXISTS',
      error: 'Bu nömrə, ad və ya cihaz üçün artıq aktiv qeydiyyat var. Əvvəlki qeydiyyatı onu yaratdığınız cihazdan ləğv edin, sonra yenidən qeydiyyatdan keçin. Cihaza girişiniz yoxdursa, studiya ilə əlaqə saxlayın.',
    });
  }

  // Generate Unique Reference Code & Secret
  const referenceCode = generateUniqueReferenceCode(bookings);
  const clientSecret = randomBytes(32).toString('hex');

  const newBooking: Booking = {
    id: randomUUID(),
    referenceCode,
    clientSecret,
    clientName: cleanName,
    clientPhone: toAzInternationalFull(normPhone),
    photoshootType: cleanType as any,
    date,
    timeSlot,
    notes: cleanNotes,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    deviceId: isAdmin ? undefined : headerDeviceId || undefined,
    deviceTokenHash,
    clientIp: clientIp || undefined,
  };

  bookings.unshift(newBooking);
  writeBookings(bookings);
  console.log(`[BOOKING CREATED] ${newBooking.referenceCode} | ${newBooking.date} ${newBooking.timeSlot}`);

  res.json({
    success: true,
    booking: isAdmin ? newBooking : publicBooking(newBooking, true),
  });
}

app.post('/api/bookings', bookingCreationLimiter, (req, res) => createBooking(req, res));

app.post('/api/admin/bookings', adminLimiter, (req, res) => {
  if (!isValidAdminKey(req.headers['x-admin-key'])) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi.' });
  }
  return createBooking(req, res, true);
});

// ==========================================
// 3. CHECK ACTIVE BOOKING FOR CURRENT DEVICE
// Proactively lets frontend know if user has an active booking
// ==========================================
app.post('/api/my-active-booking', (req, res) => {
  const tokenList = cleanTokens(req.body.tokens);

  const bookings = readBookings();

  const active = bookings.find((b) => {
    return isActiveBooking(b) && ownsBooking(b, res.locals.deviceTokenHash, tokenList);
  });

  if (!active) {
    return res.json({ hasActiveBooking: false, activeBooking: null });
  }

  // Strip private server fields
  const safeActive = {
    id: active.id,
    referenceCode: active.referenceCode,
    clientName: active.clientName,
    clientPhone: active.clientPhone,
    photoshootType: active.photoshootType,
    date: active.date,
    timeSlot: active.timeSlot,
    notes: active.notes,
    status: active.status,
    createdAt: active.createdAt,
  };

  res.json({
    hasActiveBooking: true,
    activeBooking: safeActive,
  });
});

// ==========================================
// 4. MY BOOKINGS ENDPOINT
// Ownership is required; a phone number only filters records already owned.
// Strips clientSecret, clientIp and device identifiers from responses.
// ==========================================
app.post('/api/my-bookings', searchLimiter, (req, res) => {
  const tokenList = cleanTokens(req.body.tokens);
  const cleanReqPhone = req.body.phone ? normalizePhone(req.body.phone) : '';

  const bookings = readBookings();

  const matched = bookings.filter((b) => {
    return ownsBooking(b, res.locals.deviceTokenHash, tokenList) &&
      (!req.body.phone || (!!cleanReqPhone && normalizePhone(b.clientPhone) === cleanReqPhone));
  });

  // PRIVACY SANITIZATION: Never leak clientSecret, deviceId, deviceFingerprint, or clientIp
  const sanitized = matched.map((b) => ({
    id: b.id,
    referenceCode: b.referenceCode,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    photoshootType: b.photoshootType,
    date: b.date,
    timeSlot: b.timeSlot,
    notes: b.notes,
    status: b.status,
    createdAt: b.createdAt,
    completedAt: b.completedAt,
    checkedInAt: b.checkedInAt,
    noShowAt: b.noShowAt,
    completionSource: b.completionSource,
    cancelledBy: b.cancelledBy,
  }));

  res.json({
    success: true,
    bookings: sanitized,
  });
});

// ==========================================
// 5. CANCEL BOOKING ENDPOINT
// Security: requires a signed owner cookie or the booking's private clientSecret.
// Validates status: only 'confirmed' bookings can be cancelled.
// ==========================================
app.post('/api/bookings/cancel', cancelLimiter, (req, res) => {
  const { bookingId, clientSecret } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'Bron ID tələb olunur.' });
  }

  const bookings = readBookings();
  const targetIndex = bookings.findIndex((b) => b.id === bookingId);

  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: 'Qeydiyyat tapılmadı.' });
  }

  const target = bookings[targetIndex];

  // A phone number, client-provided device ID or fingerprint cannot authorize cancellation.
  if (!ownsBooking(target, res.locals.deviceTokenHash, typeof clientSecret === 'string' ? [clientSecret.trim()] : [])) {
    return res.status(403).json({
      success: false,
      error: 'Bu qeydiyyatı ləğv etmək hüququnuz yoxdur (təhlükəsizlik açarı uyğun gəlmir).',
    });
  }

  // Status check: only confirmed bookings can be cancelled
  if (target.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      error: 'Yalnız aktiv təsdiqlənmiş ("confirmed") qeydiyyatlar ləğv edilə bilər.',
    });
  }

  // Cancel booking by client
  if (!canClientCancelBooking(target)) {
    return res.status(400).json({ success: false, errorCode: 'CANCELLATION_DEADLINE_PASSED', error: CANCELLATION_RULE + ' ' + CANCELLATION_CLOSED_MESSAGE });
  }
  target.status = 'cancelled';
  target.cancelledBy = 'client';
  writeBookings(bookings);

  console.log(`[BOOKING CANCELLED BY CLIENT] ${target.referenceCode} | ${target.date} ${target.timeSlot}`);

  res.json({
    success: true,
    message: 'Qeydiyyatınız uğurla ləğv edildi və saat dərhal təqvimdə boşaldıldı.',
  });
});

// ==========================================
// 6. ADMIN API ROUTES
// Protected by strong ADMIN_KEY
// ==========================================
app.get('/api/admin/bookings', adminReadLimiter, (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi. Düzgün admin şifrəsi daxil edin.' });
  }
  const bookings = readBookings();
  res.json({ success: true, bookings });
});

app.post('/api/admin/bookings/status', adminLimiter, (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi.' });
  }
  const { bookingId, status, expectedStatus } = req.body;
  const bookings = readBookings();
  const target = bookings.find((b) => b.id === bookingId);

  if (!target) {
    return res.status(404).json({ success: false, error: 'Qeydiyyat tapılmadı.' });
  }

  if (expectedStatus && target.status !== expectedStatus) {
    return res.status(409).json({ success: false, error: 'Bu qeydiyyatın statusu artıq dəyişib. Siyahını yeniləyib yenidən yoxlayın.' });
  }

  if (['confirmed', 'checked_in', 'cancelled', 'completed', 'no_show'].includes(status)) {
    // Conflict check when reactivating a cancelled/completed booking to confirmed
    if (status === 'confirmed' || status === 'checked_in') {
      if (studioSlotBlocked(target.date, target.timeSlot)) return res.status(409).json({ success: false, error: 'Bu saat studiya tərəfindən dolu qeyd edilib. Əvvəlcə həmin saatı açın.' });
      if (findActiveDuplicate(bookings, target, target.id)) {
        return res.status(409).json({ success: false, error: 'Bu müştərinin və ya cihazın başqa aktiv qeydiyyatı var. Əvvəlcə onu ləğv edin.' });
      }
      const hasConflict = bookings.some(
        (b) =>
          b.id !== target.id &&
          b.date === target.date &&
          isSameOrMatchingSlot(b.timeSlot, target.timeSlot) &&
          isActiveBooking(b)
      );
      if (hasConflict) {
        return res.status(409).json({
          success: false,
          error: `Tarix (${target.date}) və saat (${target.timeSlot}) üçün artıq başqa aktiv təsdiqlənmiş bron mövcuddur. İki bron üst-üstə düşə bilməz.`,
        });
      }
      target.cancelledBy = null;
      delete target.completedAt;
      delete target.completionSource;
      delete target.noShowAt;
      if (status === 'checked_in') {
        if (target.date !== getBakuTodayStr() || bookingEndsAt(target) <= Date.now()) {
          return res.status(400).json({ success: false, error: 'Gəliş yalnız bugünkü, müddəti bitməmiş çəkiliş üçün qeyd edilə bilər. Keçmiş çəkilişin nəticəsini ayrıca seçin.' });
        }
        target.checkedInAt = new Date().toISOString();
      } else {
        delete target.checkedInAt;
      }
    } else if (status === 'cancelled') {
      target.cancelledBy = 'admin';
      delete target.completedAt;
      delete target.completionSource;
      delete target.checkedInAt;
      delete target.noShowAt;
    } else if (status === 'completed') {
      target.cancelledBy = null;
      target.completedAt = new Date().toISOString();
      target.completionSource = 'admin';
      delete target.noShowAt;
    } else if (status === 'no_show') {
      if (bookingEndsAt(target) > Date.now()) {
        return res.status(400).json({ success: false, error: 'Çəkilişin vaxtı bitmədən müştərini gəlmədi kimi qeyd etmək olmaz.' });
      }
      target.cancelledBy = null;
      target.noShowAt = new Date().toISOString();
      delete target.completedAt;
      delete target.completionSource;
      delete target.checkedInAt;
    }

    target.status = status;
    writeBookings(bookings);
    return res.json({ success: true, booking: target });
  }

  res.status(400).json({ success: false, error: 'Düzgün status təyin edilməyib.' });
});

app.post('/api/admin/bookings/delete', adminLimiter, (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi.' });
  }
  const { bookingId } = req.body;
  let bookings = readBookings();
  if (!bookings.some((booking) => booking.id === bookingId)) {
    return res.status(404).json({ success: false, error: 'Qeydiyyat tapılmadı.' });
  }
  bookings = bookings.filter((b) => b.id !== bookingId);
  backups!.create('before_delete');
  writeBookings(bookings);
  res.json({ success: true });
});

// ==========================================
// 7. SERVER / VITE INTEGRATION
// ==========================================
async function startServer() {
  const isProd = isProduction;

  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API ünvanı tapılmadı.' });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API error:', err);
    const status = [400, 413, 415].includes(err.status) ? err.status : 500;
    res.status(status).json({
      success: false,
      error: status === 413 ? 'Faylın ölçüsü icazə verilən həddi aşır.' : status === 415 ? 'Sıxılmış sorğu məzmununa icazə verilmir.' : status === 400 ? 'Göndərilən məlumat düzgün deyil.' : 'Məlumatı saxlamaq mümkün olmadı. Yenidən cəhd edin.',
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false, // Disables WebSocket completely to eliminate browser console WebSocket errors
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
