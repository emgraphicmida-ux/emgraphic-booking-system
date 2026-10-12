import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import rateLimit from 'express-rate-limit';
import { Booking, ALL_TIME_SLOTS, isSameOrMatchingSlot } from './src/types/booking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'bookings.json');
const LOGO_FILE = path.resolve(DATA_DIR, 'logo.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');

// General JSON body limit is strictly constrained to 50kb to prevent payload abuse.
// The large limit is only provided specifically on the logo upload route.
app.use(express.json({ limit: '50kb' }));

// Prevent browser/mobile caching on all API endpoints so updates from any device reflect instantly
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Atomic write helper to prevent file corruption during sudden restarts or concurrent writes
function atomicWriteFileSync(filePath: string, content: string): void {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

// ==========================================
// ADMIN AUTHENTICATION
// Strict comparison against process.env.ADMIN_KEY
// ==========================================
const ADMIN_KEY = (process.env.ADMIN_KEY || 'Emgraphic_Mida_2026_SecureAdminKey!').trim();

function isValidAdminKey(adminKey: any): boolean {
  if (!adminKey) return false;
  return String(adminKey).trim() === ADMIN_KEY;
}

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
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading bookings DB:', err);
  }
  return [];
}

// Helper to write bookings to DB atomically
function writeBookings(bookings: Booking[]): void {
  try {
    atomicWriteFileSync(DB_FILE, JSON.stringify(bookings, null, 2));
  } catch (err) {
    console.error('Error writing bookings DB:', err);
  }
}

// ==========================================
// ANTI-ABUSE & NORMALIZATION HELPERS
// ==========================================
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('994')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(-9); // last 9 digits in Azerbaijan (e.g. 501234567)
}

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
// ADVANCE BOOKING NOTICE RULE (Çəkilişə ən azı 2 saat öncədən yazılmaq lazımdır)
// ==========================================
const MIN_ADVANCE_NOTICE_HOURS = 2;

function checkAdvanceNotice(dateStr: string, slotStr: string): { isValid: boolean; error?: string } {
  const baku = getBakuNowDetails();
  const todayStr = baku.dateStr;

  if (dateStr < todayStr) {
    return {
      isValid: false,
      error: `Keçmiş tarixlərə çəkiliş sifarişi qəbul edilmir (Bakı vaxtı ilə).`,
    };
  }

  // Future dates are valid
  if (dateStr > todayStr) {
    return { isValid: true };
  }

  // For TODAY in Baku: check against current Baku time with 2-hour minimum notice
  const match = String(slotStr).match(/^(\d{1,2}):(\d{2})/);
  const slotStartDecimal = match ? parseInt(match[1], 10) + parseInt(match[2], 10) / 60 : 0;
  const currentDecimalHour = baku.decimalHour;

  if (slotStartDecimal <= currentDecimalHour) {
    return {
      isValid: false,
      error: `Seçilmiş saat artıq keçmişdir (Cari Bakı vaxtı: ${baku.timeStr}). Zəhmət olmasa sonrakı vaxtı və ya sabahkı günü seçin.`,
    };
  }

  if (slotStartDecimal < currentDecimalHour + MIN_ADVANCE_NOTICE_HOURS) {
    return {
      isValid: false,
      error: `Çəkilişə ən azı ${MIN_ADVANCE_NOTICE_HOURS} saat öncədən yazılmaq lazımdır (Cari Bakı vaxtı: ${baku.timeStr}). Zəhmət olmasa daha sonrakı saatı seçin.`,
    };
  }

  return { isValid: true };
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
app.post('/api/settings/logo', adminLimiter, express.json({ limit: '10mb' }), (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!isValidAdminKey(adminKey)) {
    return res.status(401).json({ success: false, error: 'İcazə verilmədi. Düzgün admin şifrəsi tələb olunur.' });
  }

  try {
    const { logoUrl } = req.body;
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
      return res.json({ success: true, settings: data });
    }
    return res.json({
      success: true,
      settings: {
        whatsappNumber: '+994 77 607 97 07',
        studioAddress: 'Hövsan, MİDA 1, Bina 1',
        studioName: 'Emgraphic Studio',
      },
    });
  } catch {
    return res.json({
      success: true,
      settings: { whatsappNumber: '+994 77 607 97 07' },
    });
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
      try {
        current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      } catch {}
    }
    const updated = {
      ...current,
      ...(whatsappNumber !== undefined ? { whatsappNumber: String(whatsappNumber).trim() } : {}),
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
    .filter((b) => b.status === 'confirmed')
    .map((b) => ({
      date: b.date,
      timeSlot: b.timeSlot,
    }));

  res.json({ success: true, bookedSlots });
});

// ==========================================
// 2. CREATE BOOKING ENDPOINT
// Strict input validation & anti-abuse checks
// ==========================================
app.post('/api/bookings', bookingCreationLimiter, (req, res) => {
  const { clientName, clientPhone, photoshootType, date, timeSlot, notes, deviceId, deviceFingerprint } = req.body;
  const headerDeviceId = (req.headers['x-device-id'] as string) || deviceId;
  const headerDeviceFp = (req.headers['x-device-fingerprint'] as string) || deviceFingerprint;
  const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '').split(',')[0].trim();

  // 1. Input presence check
  if (!clientName || !clientPhone || !date || !timeSlot || !photoshootType) {
    return res.status(400).json({
      success: false,
      error: 'Zəhmət olmasa bütün tələb olunan xanaları doldurun.',
    });
  }

  // 2. Name validation
  const cleanName = String(clientName).trim();
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    return res.status(400).json({
      success: false,
      error: 'Tarix formatı düzgün deyil (YYYY-MM-DD tələb olunur).',
    });
  }

  // 5. TimeSlot validation (must be in ALL_TIME_SLOTS)
  if (!ALL_TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({
      success: false,
      error: 'Seçilmiş çəkiliş saatı studiyanın iş qrafikinə uyğun deyil.',
    });
  }

  // 6. Photoshoot type validation
  const cleanType = String(photoshootType).trim();
  if (cleanType.length < 3 || cleanType.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Çəkiliş növü düzgün seçilməyib.',
    });
  }

  // 7. Notes length validation
  const cleanNotes = notes ? String(notes).trim().slice(0, 500) : '';

  const bookings = readBookings();
  const todayStr = getBakuTodayStr();

  // 8. Check Advance Notice Studio Rule (Çəkilişə ən azı 2 saat öncədən yazılmaq lazımdır)
  const advanceCheck = checkAdvanceNotice(date, timeSlot);
  if (!advanceCheck.isValid) {
    return res.status(400).json({
      success: false,
      error: advanceCheck.error,
    });
  }

  // 9. Check if the specific slot is already booked by another customer
  const isConflict = bookings.some(
    (b) => b.date === date && isSameOrMatchingSlot(b.timeSlot, timeSlot) && b.status === 'confirmed'
  );

  if (isConflict) {
    return res.status(409).json({
      success: false,
      error: 'Təəssüf ki, bu saat artıq başqa bir müştəri tərəfindən bron edilib. Zəhmət olmasa başqa saat seçin.',
    });
  }

  // 10. Anti-abuse: 1 active future booking per customer phone number
  const existingActive = bookings.find(
    (b) =>
      b.status === 'confirmed' &&
      b.date >= todayStr &&
      normalizePhone(b.clientPhone) === normPhone
  );
  if (existingActive) {
    return res.status(409).json({
      success: false,
      error: `Daxil etdiyiniz əlaqə nömrəsi ilə artıq aktiv qeydiyyat mövcuddur (${existingActive.date}, saat ${existingActive.timeSlot}). Vaxtı dəyişmək üçün əvvəlcə mövcud qeydiyyatınızı ləğv edin.`,
      activeBooking: {
        id: existingActive.id,
        referenceCode: existingActive.referenceCode,
        date: existingActive.date,
        timeSlot: existingActive.timeSlot,
      },
    });
  }

  // Generate Unique Reference Code & Secret
  const referenceCode = generateUniqueReferenceCode(bookings);
  const clientSecret = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;

  const newBooking: Booking = {
    id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    referenceCode,
    clientSecret,
    clientName: cleanName,
    clientPhone: String(clientPhone).trim(),
    photoshootType: cleanType as any,
    date,
    timeSlot,
    notes: cleanNotes,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    deviceId: headerDeviceId || undefined,
    deviceFingerprint: headerDeviceFp || undefined,
    clientIp: clientIp || undefined,
  };

  bookings.unshift(newBooking);
  writeBookings(bookings);
  console.log(`✅ [BOOKING CREATED] ${newBooking.referenceCode} | ${newBooking.clientName} | ${newBooking.date} ${newBooking.timeSlot}`);

  res.json({
    success: true,
    booking: newBooking,
  });
});

// ==========================================
// 3. CHECK ACTIVE BOOKING FOR CURRENT DEVICE
// Proactively lets frontend know if user has an active booking
// ==========================================
app.post('/api/my-active-booking', (req, res) => {
  const { deviceId, deviceFingerprint, tokens } = req.body;
  const headerDeviceId = (req.headers['x-device-id'] as string) || deviceId;
  const headerDeviceFp = (req.headers['x-device-fingerprint'] as string) || deviceFingerprint;
  const tokenList: string[] = Array.isArray(tokens) ? tokens : [];

  const bookings = readBookings();
  const todayStr = getBakuTodayStr();

  const active = bookings.find((b) => {
    if (b.status !== 'confirmed' || b.date < todayStr) return false;
    if (b.clientSecret && tokenList.includes(b.clientSecret)) return true;
    if (headerDeviceId && b.deviceId && b.deviceId === headerDeviceId) return true;
    if (headerDeviceFp && b.deviceFingerprint && b.deviceFingerprint === headerDeviceFp) return true;
    return false;
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
// PRIVACY: Exact matching only (normalizePhone === cleanPhone).
// Strips clientSecret, clientIp, deviceId, deviceFingerprint from response!
// ==========================================
app.post('/api/my-bookings', searchLimiter, (req, res) => {
  const { tokens, phone, deviceId } = req.body;
  const headerDeviceId = (req.headers['x-device-id'] as string) || deviceId;
  const tokenList: string[] = Array.isArray(tokens) ? tokens : [];
  const cleanReqPhone = phone ? normalizePhone(phone) : '';

  const bookings = readBookings();

  const matched = bookings.filter((b) => {
    // 1. Client secret token matches
    if (b.clientSecret && tokenList.includes(b.clientSecret)) {
      return true;
    }
    // 2. Device ID matches
    if (headerDeviceId && b.deviceId && b.deviceId === headerDeviceId) {
      return true;
    }
    // 3. Strict phone match (EXACT match, must be 9 digits, NO partial substring search)
    if (cleanReqPhone && cleanReqPhone.length === 9) {
      const bNormPhone = normalizePhone(b.clientPhone);
      if (bNormPhone === cleanReqPhone) {
        return true;
      }
    }
    return false;
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
    cancelledBy: b.cancelledBy,
  }));

  res.json({
    success: true,
    bookings: sanitized,
  });
});

// ==========================================
// 5. CANCEL BOOKING ENDPOINT
// Security: Requires clientSecret! Phone-based cancellation removed.
// Validates status: only 'confirmed' bookings can be cancelled.
// ==========================================
app.post('/api/bookings/cancel', cancelLimiter, (req, res) => {
  const { bookingId, clientSecret } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'Bron ID tələb olunur.' });
  }

  if (!clientSecret || typeof clientSecret !== 'string') {
    return res.status(403).json({
      success: false,
      error: 'Qeydiyyatı ləğv etmək üçün təhlükəsizlik açarı (clientSecret) tələb olunur.',
    });
  }

  const bookings = readBookings();
  const targetIndex = bookings.findIndex((b) => b.id === bookingId);

  if (targetIndex === -1) {
    return res.status(404).json({ success: false, error: 'Qeydiyyat tapılmadı.' });
  }

  const target = bookings[targetIndex];

  // Ownership verification: strictly match clientSecret
  if (target.clientSecret !== clientSecret.trim()) {
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
  target.status = 'cancelled';
  target.cancelledBy = 'client';
  writeBookings(bookings);

  console.log(`❌ [BOOKING CANCELLED BY CLIENT] ${target.referenceCode} | ${target.clientName} | ${target.date} ${target.timeSlot}`);

  res.json({
    success: true,
    message: 'Qeydiyyatınız uğurla ləğv edildi və saat dərhal təqvimdə boşaldıldı.',
  });
});

// ==========================================
// 6. ADMIN API ROUTES
// Protected by strong ADMIN_KEY
// ==========================================
app.get('/api/admin/bookings', adminLimiter, (req, res) => {
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
  const { bookingId, status } = req.body;
  const bookings = readBookings();
  const target = bookings.find((b) => b.id === bookingId);

  if (!target) {
    return res.status(404).json({ success: false, error: 'Qeydiyyat tapılmadı.' });
  }

  if (status === 'confirmed' || status === 'cancelled' || status === 'completed') {
    // Conflict check when reactivating a cancelled/completed booking to confirmed
    if (status === 'confirmed') {
      const hasConflict = bookings.some(
        (b) =>
          b.id !== target.id &&
          b.date === target.date &&
          isSameOrMatchingSlot(b.timeSlot, target.timeSlot) &&
          b.status === 'confirmed'
      );
      if (hasConflict) {
        return res.status(409).json({
          success: false,
          error: `Tarix (${target.date}) və saat (${target.timeSlot}) üçün artıq başqa aktiv təsdiqlənmiş bron mövcuddur. İki bron üst-üstə düşə bilməz.`,
        });
      }
      target.cancelledBy = null;
    } else if (status === 'cancelled') {
      target.cancelledBy = 'admin';
    } else if (status === 'completed') {
      target.completedAt = new Date().toISOString();
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
  bookings = bookings.filter((b) => b.id !== bookingId);
  writeBookings(bookings);
  res.json({ success: true });
});

// ==========================================
// 7. SERVER / VITE INTEGRATION
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

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

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
