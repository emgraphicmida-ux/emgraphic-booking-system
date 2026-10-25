import { createHash, randomBytes } from 'node:crypto';
import type { Booking } from '../src/types/booking.js';

// Digests only: previously committed customer capabilities must never authorize
// requests again, including after restoring an older legitimate backup.
export const REVOKED_CLIENT_SECRET_HASHES: ReadonlySet<string> = new Set(["960b1833069c19eea35e1d13292deaf7941c047f6b56123fa622b0c98f704854","124d6bfa2b0bf368f7293e5da3fef61b33409c4ff556a179ef4d36484a372016","ca4798ff35f70379fe7c1fe8759c381df5dd9b5b82adb2db99750d5b9fc08bf1","07485b4a88027b6c8f61be46e10cb3611b169abc02f57c05a39d2a72fd767d99"]);

export function isRevokedClientSecret(value: unknown, hashes = REVOKED_CLIENT_SECRET_HASHES): boolean {
  return typeof value === 'string' && hashes.has(createHash('sha256').update(value).digest('hex'));
}

export function rotateExposedBookingSecrets(bookings: Booking[], hashes = REVOKED_CLIENT_SECRET_HASHES): boolean {
  let changed = false;
  for (const booking of bookings) {
    if (isRevokedClientSecret(booking.clientSecret, hashes)) {
      booking.clientSecret = randomBytes(32).toString('hex');
      changed = true;
    }
  }
  return changed;
}
