import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { normalizeName, normalizePhone } from '../server/identity.ts';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = path.resolve(tmpdir());
const key = randomUUID();
let child, dataDir, port, base, logs;
const nextDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const input = (overrides = {}) => ({
  clientName: 'Əli Məmmədov', clientPhone: '+994 50 123 45 67', date: nextDate(),
  timeSlot: '10:00', photoshootType: '1 dekor (20-25 kadr fotoşəkil)', ...overrides,
});
const browser = () => ({ deviceId: 'did_' + randomUUID(), cookie: '' });
async function request(visitor, route, body, admin = false, extraHeaders = {}) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-device-id': visitor.deviceId,
      ...(visitor.cookie ? { Cookie: visitor.cookie } : {}),
      ...(admin ? { 'x-admin-key': key } : {}), ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookieHeaders = response.headers.getSetCookie();
  if (cookieHeaders.length) visitor.cookie = cookieHeaders[0].split(';')[0];
  return { status: response.status, data: await response.json(), cookieHeaders };
}
async function start() {
  logs = '';
  child = spawn(process.execPath, ['server.js'], {
    cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DATA_DIR: dataDir, ADMIN_KEY: key, TRUST_PROXY: '' },
  });
  child.stdout.on('data', c => { logs += c; }); child.stderr.on('data', c => { logs += c; });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/time')).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error('Startup failed: ' + logs);
}
async function stop() {
  if (child && child.exitCode === null) {
    const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done;
  }
}
beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tempRoot, 'emgraphic-security-'));
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  base = 'http://127.0.0.1:' + port;
  await start();
});
afterEach(async () => {
  await stop();
  if (!path.resolve(dataDir).startsWith(tempRoot + path.sep) || !path.basename(dataDir).startsWith('emgraphic-security-')) throw new Error('Invalid cleanup path');
  rmSync(dataDir, { recursive: true, force: true });
});

test('same phone on another device is blocked until the owner cancels', async () => {
  const first = browser(), other = browser();
  const created = await request(first, '/api/bookings', input());
  assert.equal(created.status, 200);
  const duplicate = await request(other, '/api/bookings', input({ clientName: 'Başqa Ad', clientPhone: '0501234567', timeSlot: '12:30' }));
  assert.equal(duplicate.status, 409); assert.equal(duplicate.data.errorCode, 'ACTIVE_BOOKING_EXISTS');
  assert.equal(duplicate.data.activeBooking, undefined);
  assert.equal((await request(first, '/api/bookings/cancel', { bookingId: created.data.booking.id })).status, 200);
  assert.equal((await request(other, '/api/bookings', input({ clientName: 'Başqa Ad', clientPhone: '00994501234567', timeSlot: '12:30' }))).status, 200);
});

test('normalized names block duplicates even with another phone and device', async () => {
  const first = browser(), other = browser();
  assert.equal((await request(first, '/api/bookings', input())).status, 200);
  assert.equal((await request(other, '/api/bookings', input({ clientName: '  ƏLİ   MƏMMƏDOV ', clientPhone: '+994 51 765 43 21', timeSlot: '11:00' }))).status, 409);
  assert.equal(normalizeName('  ƏLİ  MƏMMƏDOV '), normalizeName('Əli Məmmədov'));
  assert.equal(normalizePhone('123994501234567'), '');
  assert.equal(normalizePhone('+994 50 123 45 67'), '501234567');
});

test('same signed cookie or persistent device ID blocks another name and phone', async () => {
  const first = browser();
  const savedId = first.deviceId;
  const created = await request(first, '/api/bookings', input());
  assert.equal(created.status, 200);
  first.deviceId = 'did_' + randomUUID();
  const next = input({ clientName: 'Fərqli Müştəri', clientPhone: '+994 55 765 43 21', timeSlot: '11:30' });
  assert.equal((await request(first, '/api/bookings', next)).status, 409);
  const noCookie = { deviceId: savedId, cookie: '' };
  assert.equal((await request(noCookie, '/api/bookings', next)).status, 409);
  const recovered = await request(first, '/api/my-active-booking', {});
  assert.equal(recovered.data.activeBooking.id, created.data.booking.id);
  assert.equal((await request(first, '/api/bookings/cancel', { bookingId: created.data.booking.id })).status, 200);
  assert.equal((await request(first, '/api/bookings', next)).status, 200);
});

test('local secret tokens enforce the limit even after both device markers change', async () => {
  const first = browser(), other = browser();
  const created = await request(first, '/api/bookings', input());
  const next = input({ clientName: 'Başqa Müştəri', clientPhone: '+994 55 765 43 21', timeSlot: '13:30', tokens: [created.data.booking.clientSecret] });
  assert.equal((await request(other, '/api/bookings', next)).status, 409);
});

test('phone, device ID, fingerprint and forged cookies cannot disclose or cancel another customer', async () => {
  const owner = browser(), stranger = browser();
  const result = await request(owner, '/api/bookings', input());
  const booking = result.data.booking;
  assert.match(result.cookieHeaders[0], /HttpOnly/i); assert.match(result.cookieHeaders[0], /SameSite=Lax/i);
  for (const field of ['clientIp', 'deviceId', 'deviceFingerprint', 'deviceTokenHash']) assert.equal(booking[field], undefined);
  stranger.deviceId = owner.deviceId;
  stranger.cookie = owner.cookie.slice(0, -1) + (owner.cookie.endsWith('a') ? 'b' : 'a');
  const list = await request(stranger, '/api/my-bookings', { phone: input().clientPhone, deviceId: owner.deviceId });
  assert.deepEqual(list.data.bookings, []);
  const active = await request(stranger, '/api/my-active-booking', { deviceId: owner.deviceId, deviceFingerprint: 'dfp_fallback' });
  assert.equal(active.data.hasActiveBooking, false);
  assert.equal((await request(stranger, '/api/bookings/cancel', { bookingId: booking.id, clientSecret: 'wrong' })).status, 403);
  const mine = await request(owner, '/api/my-bookings', { phone: '0501234567' });
  assert.equal(mine.data.bookings.length, 1);
  for (const field of ['clientIp', 'deviceTokenHash', 'clientSecret', 'deviceId']) assert.equal(mine.data.bookings[0][field], undefined);
});

test('real request IP is admin-only, ignores untrusted headers, and does not block shared networks', async () => {
  const first = browser(), other = browser(), admin = browser();
  const created = await request(first, '/api/bookings', input(), false, { 'x-forwarded-for': '203.0.113.99', 'x-real-ip': '203.0.113.98' });
  assert.equal(created.status, 200);
  assert.equal((await request(other, '/api/bookings', input({ clientName: 'Digər Şəxs', clientPhone: '+994 55 765 43 21', timeSlot: '12:00' }))).status, 200);
  const records = (await request(admin, '/api/admin/bookings', undefined, true)).data.bookings;
  assert.ok(records.every(b => b.clientIp === '127.0.0.1'));
});

test('parallel submissions from one browser can create only one active booking', async () => {
  const first = browser();
  await request(first, '/api/time');
  const submissions = await Promise.all([
    request(first, '/api/bookings', input()),
    request(first, '/api/bookings', input({ clientName: 'İkinci Ad', clientPhone: '+994 55 765 43 21', timeSlot: '12:30' })),
  ]);
  assert.deepEqual(submissions.map(r => r.status).sort(), [200, 409]);
  assert.equal((await request(browser(), '/api/admin/bookings', undefined, true)).data.bookings.length, 1);
});

test('admin creation and restoration cannot bypass phone/name uniqueness', async () => {
  const first = browser(), admin = browser(), other = browser();
  const old = (await request(first, '/api/bookings', input())).data.booking;
  assert.equal((await request(admin, '/api/admin/bookings', input({ timeSlot: '13:00' }), true)).status, 409);
  await request(first, '/api/bookings/cancel', { bookingId: old.id });
  assert.equal((await request(other, '/api/bookings', input({ timeSlot: '13:00' }))).status, 200);
  assert.equal((await request(admin, '/api/admin/bookings/status', { bookingId: old.id, status: 'confirmed' }, true)).status, 409);
});

test('cookie ownership survives a server restart without local-storage secrets', async () => {
  const owner = browser();
  const created = (await request(owner, '/api/bookings', input())).data.booking;
  await stop(); await start();
  owner.deviceId = 'did_' + randomUUID();
  const restored = await request(owner, '/api/my-active-booking', {});
  assert.equal(restored.data.activeBooking.id, created.id);
  assert.equal((await request(owner, '/api/bookings/cancel', { bookingId: created.id })).status, 200);
});

test('bad input and cross-origin writes are rejected; booking attempts remain rate-limited', async () => {
  const owner = browser();
  assert.equal((await request(owner, '/api/bookings', input(), false, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request(owner, '/api/bookings', [])).status, 400);
  assert.equal((await request(owner, '/api/bookings', input({ clientName: {} }))).status, 400);
  assert.equal((await request(owner, '/api/bookings', input({ clientPhone: '123994501234567' }))).status, 400);
  // Two rejected inputs reached the route's limiter. The ninth subsequent attempt exceeds ten.
  for (let i = 0; i < 8; i++) assert.notEqual((await request(owner, '/api/bookings', input())).status, 429);
  assert.equal((await request(owner, '/api/bookings', input())).status, 429);
});
