import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Booking } from '../src/types/booking';
import { isActiveBooking } from '../src/utils/attendance.js';
import { parseAzPhone } from '../src/utils/phoneUtils.js';
import { isRevokedClientSecret } from './legacySecrets.js';

export function sameSecret(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function normalizePhone(raw: unknown): string {
  return parseAzPhone(raw);
}
export function normalizeName(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('az-AZ') : '';
}
export function cleanDeviceId(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(raw) ? raw : undefined;
}
export function cleanTokens(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string' && t.length >= 16 && t.length <= 128 && !isRevokedClientSecret(t)).slice(-100) : [];
}
const cookieName = '_emg_verified_device';
export function visitorDevice(req: Request, res: Response, secret: string): string {
  const raw = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  const parts = raw.match(/^([a-f0-9]{64})\.([a-f0-9]{64})$/);
  const sign = (token: string) => createHmac('sha256', secret).update(token).digest('hex');
  let token = parts && sameSecret(parts[2], sign(parts[1])) ? parts[1] : '';
  const issueCookie = !token || req.secure;
  if (!token) token = randomBytes(32).toString('hex');
  // Browsers never send cookie flags back. Reissue on HTTPS to upgrade cookies
  // originally issued on a local/HTTP preview without changing ownership.
  if (issueCookie) {
    res.cookie(cookieName, token + '.' + sign(token), {
      httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', maxAge: 365 * 24 * 60 * 60 * 1000,
    });
  }
  return createHash('sha256').update(token).digest('hex');
}
export function ownsBooking(booking: Booking, deviceHash: string, tokens: string[]): boolean {
  return !!(booking.deviceTokenHash && sameSecret(booking.deviceTokenHash, deviceHash)) ||
    !!(booking.clientSecret && !isRevokedClientSecret(booking.clientSecret) && tokens.some(token => sameSecret(token, booking.clientSecret)));
}
type Identity = Pick<Booking, 'clientName' | 'clientPhone' | 'deviceId' | 'deviceTokenHash'> & { tokens?: string[] };
export function findActiveDuplicate(bookings: Booking[], identity: Identity, exceptId?: string): Booking | undefined {
  const phone = normalizePhone(identity.clientPhone);
  const name = normalizeName(identity.clientName);
  return bookings.find(booking => booking.id !== exceptId && isActiveBooking(booking) && (
    (!!phone && normalizePhone(booking.clientPhone) === phone) ||
    (!!name && normalizeName(booking.clientName) === name) ||
    (!!identity.deviceId && booking.deviceId === identity.deviceId) ||
    (!!identity.deviceTokenHash && booking.deviceTokenHash === identity.deviceTokenHash) ||
    !!(booking.clientSecret && identity.tokens?.some(token => sameSecret(token, booking.clientSecret)))
  ));
}
export function publicBooking(booking: Booking, withSecret = false) {
  const { clientSecret, clientIp, deviceId, deviceFingerprint, deviceTokenHash, ...safe } = booking;
  return withSecret ? { ...safe, clientSecret } : safe;
}
