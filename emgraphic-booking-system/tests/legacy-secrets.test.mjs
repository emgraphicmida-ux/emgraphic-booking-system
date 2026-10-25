import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isRevokedClientSecret, rotateExposedBookingSecrets, REVOKED_CLIENT_SECRET_HASHES } from '../server/legacySecrets.ts';

test('revoked capability digests reject old secrets and rotation preserves the booking itself', () => {
  const exposed = 'synthetic-previously-published-token';
  const hashes = new Set([createHash('sha256').update(exposed).digest('hex')]);
  const record = { id: 'synthetic-booking', status: 'confirmed', clientSecret: exposed };
  const untouched = { id: 'safe-booking', status: 'confirmed', clientSecret: 'unexposed-synthetic-token' };
  assert.equal(isRevokedClientSecret(exposed, hashes), true);
  assert.equal(rotateExposedBookingSecrets([record, untouched], hashes), true);
  assert.match(record.clientSecret, /^[a-f0-9]{64}$/);
  assert.equal(isRevokedClientSecret(record.clientSecret, hashes), false);
  assert.equal(record.id, 'synthetic-booking');
  assert.equal(record.status, 'confirmed');
  assert.equal(untouched.clientSecret, 'unexposed-synthetic-token');
  assert.equal(rotateExposedBookingSecrets([record, untouched], hashes), false);
  for (const digest of REVOKED_CLIENT_SECRET_HASHES) assert.match(digest, /^[a-f0-9]{64}$/);
});
