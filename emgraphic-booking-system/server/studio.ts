import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ALL_TIME_SLOTS } from '../src/types/booking.js';
import type { StudioBlock } from '../src/types/studio.js';
export type { StudioBlock } from '../src/types/studio.js';

export function validStudioDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function readStudioBlocks(directory: string): StudioBlock[] {
  const data = JSON.parse(fs.readFileSync(path.join(directory, 'studio-blocks.json'), 'utf8'));
  if (!Array.isArray(data) || data.some(b => !b || typeof b.id !== 'string' || !validStudioDate(b.date) || !Array.isArray(b.timeSlots) || !b.timeSlots.length || b.timeSlots.some((s: string) => !ALL_TIME_SLOTS.includes(s)) || typeof b.reason !== 'string')) throw new Error('Studiya saatları faylı düzgün deyil.');
  return data;
}

const files = ['bookings.json', 'settings.json', 'studio-blocks.json', 'logo.json'] as const;
type Snapshot = { version: 1; id: string; createdAt: string; kind: string; day: string; files: Record<string, string | null> };
export class StudioBackups {
  private folder: string;
  private journal: string;
  private dailyDay = '';
  constructor(private directory: string, private signingKey: string, private notify: () => void) {
    this.folder = path.join(directory, 'backups');
    this.journal = path.join(directory, '.restore-pending.json');
    fs.mkdirSync(this.folder, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') fs.chmodSync(this.folder, 0o700);
    // Finish a fully validated restore interrupted by a power cut before accepting requests.
    if (fs.existsSync(this.journal)) {
      const snapshot = this.verify(fs.readFileSync(this.journal, 'utf8'));
      this.apply(snapshot);
      fs.unlinkSync(this.journal);
    }
  }
  private atomic(file: string, text: string) {
    const temporary = file + '.' + randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary, text, { mode: 0o600, flag: 'wx', flush: true }); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  private seal(snapshot: Snapshot) {
    const payload = JSON.stringify(snapshot);
    return JSON.stringify({ payload, signature: createHmac('sha256', this.signingKey).update(payload).digest('hex') });
  }
  private verify(raw: string): Snapshot {
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw new Error('Ehtiyat nüsxə zədələnib.');
    const expected = createHmac('sha256', this.signingKey).update(envelope.payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(envelope.signature, 'hex'))) throw new Error('Ehtiyat nüsxənin bütövlüyü təsdiqlənmədi.');
    const snapshot = JSON.parse(envelope.payload) as Snapshot;
    if (snapshot.version !== 1 || !snapshot.files || !Array.isArray(JSON.parse(snapshot.files['bookings.json']!)) || !Array.isArray(JSON.parse(snapshot.files['studio-blocks.json']!))) throw new Error('Ehtiyat nüsxənin formatı düzgün deyil.');
    for (const file of files) {
      const content = snapshot.files[file];
      if (content === null && file === 'logo.json') continue;
      if (typeof content !== 'string') throw new Error('Ehtiyat nüsxə natamamdır.');
      JSON.parse(content);
    }
    return snapshot;
  }
  private fileFor(id: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) throw new Error('Nüsxə tapılmadı.');
    return path.join(this.folder, id + '.json');
  }
  private metadata(s: Snapshot) {
    return { id: s.id, createdAt: s.createdAt, kind: s.kind, day: s.day, bookingCount: JSON.parse(s.files['bookings.json']!).length, blockCount: JSON.parse(s.files['studio-blocks.json']!).length };
  }
  list() {
    return fs.readdirSync(this.folder).filter(f => /^[a-f0-9-]{36}\.json$/.test(f)).map(file => {
      try { return this.metadata(this.verify(fs.readFileSync(path.join(this.folder, file), 'utf8'))); }
      catch { return null; } // A damaged copy is never offered for restore.
    }).filter((s): s is NonNullable<typeof s> => s !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  create(kind = 'manual') {
    const snapshot: Snapshot = { version: 1, id: randomUUID(), createdAt: new Date().toISOString(), day: this.today(), kind, files: {} };
    for (const file of files) snapshot.files[file] = fs.existsSync(path.join(this.directory, file)) ? fs.readFileSync(path.join(this.directory, file), 'utf8') : null;
    const text = this.seal(snapshot);
    this.verify(text); // Never save a supposedly healthy copy of unreadable JSON.
    this.atomic(this.fileFor(snapshot.id), text);
    this.notify();
    return this.metadata(snapshot);
  }
  private today() { return new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10); }
  ensureDaily() {
    const day = this.today();
    if (this.dailyDay === day) return;
    if (!this.list().some(s => s.kind === 'daily' && s.day === day)) this.create('daily');
    this.dailyDay = day;
  }
  download(id: string) {
    const snapshot = this.verify(fs.readFileSync(this.fileFor(id), 'utf8'));
    // Portable export: includes the ownership key needed to preserve signed customer cookies.
    // It is only returned to an authenticated admin; never stored in public assets.
    return JSON.stringify({ format: 'emgraphic-backup-v1', snapshot, deviceCookieKey: this.signingKey }, null, 2);
  }
  private apply(snapshot: Snapshot) {
    for (const file of files) {
      const target = path.join(this.directory, file), content = snapshot.files[file];
      if (content === null) { if (fs.existsSync(target)) fs.unlinkSync(target); }
      else this.atomic(target, content);
    }
  }
  restore(id: string) {
    const raw = fs.readFileSync(this.fileFor(id), 'utf8');
    const snapshot = this.verify(raw);
    const safety = this.create('before_restore');
    this.atomic(this.journal, raw);
    try { this.apply(snapshot); fs.unlinkSync(this.journal); }
    catch (error) {
      // Roll back in process too; the journal remains a restart recovery path if disk I/O fails.
      const rollbackRaw = fs.readFileSync(this.fileFor(safety.id), 'utf8');
      this.atomic(this.journal, rollbackRaw);
      this.apply(this.verify(rollbackRaw));
      fs.unlinkSync(this.journal);
      throw error;
    }
    this.notify();
    return this.metadata(snapshot);
  }
}
