import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = path.resolve(tmpdir());
const dataDir = mkdtempSync(path.join(tempRoot, 'emgraphic-api-test-'));
const adminKey = randomUUID();
let child, base, logs = '';
const futureDate = (offset = 7) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const input = (timeSlot = '10:30', overrides = {}) => ({
  clientName: 'Test Müştəri',
  clientPhone: '+994 50 123 45 67',
  photoshootType: '1 dekor (20-25 kadr fotoşəkil)',
  date: futureDate(),
  timeSlot,
  ...overrides,
});
async function request(route, body, admin = false) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-admin-key': adminKey } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

before(async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['server.js'], {
    cwd: project,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), ADMIN_KEY: adminKey, DATA_DIR: dataDir },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await request('/api/time')).status === 200) return; } catch {}
    if (child.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server startup timed out: ' + logs);
});
beforeEach(() => { writeFileSync(path.join(dataDir, 'bookings.json'), '[]'); });
after(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  // Only remove the unique test directory created above.
  if (!path.resolve(dataDir).startsWith(tempRoot + path.sep) || !path.basename(dataDir).startsWith('emgraphic-api-test-')) throw new Error('Invalid cleanup path');
  rmSync(dataDir, { recursive: true, force: true });
});

test('10:00 and 10:30 are independent, and public availability has no customer data', async () => {
  const first = await request('/api/bookings', input('10:00'));
  const second = await request('/api/bookings', input('10:30', { clientName: 'Digər Müştəri', clientPhone: '+994 51 123 45 67' }));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const availability = await request('/api/availability');
  assert.deepEqual(availability.data.bookedSlots.map(b => b.timeSlot).sort(), ['10:00', '10:30']);
  for (const slot of availability.data.bookedSlots) assert.deepEqual(Object.keys(slot).sort(), ['date', 'timeSlot']);
  const duplicate = await request('/api/bookings', input('10:30', { clientPhone: '+994 55 123 45 67' }));
  assert.equal(duplicate.status, 409);
});

test('all 21 half-hour slots through 20:00 are accepted by the admin API', async () => {
  const expected = Array.from({ length: 21 }, (_, i) => {
    const minutes = 600 + i * 30;
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  });
  for (const [index, slot] of expected.entries()) {
    const result = await request('/api/admin/bookings', input(slot, { clientName: 'Müştəri ' + index, clientPhone: '50' + (1000000 + index) }), true);
    assert.equal(result.status, 200, slot);
    assert.equal(result.data.booking.timeSlot, slot);
    assert.equal(result.data.booking.deviceId, undefined);
  }
  const bookings = await request('/api/admin/bookings', undefined, true);
  assert.equal(bookings.data.bookings.length, 21);
  assert.equal(JSON.parse(readFileSync(path.join(dataDir, 'bookings.json'), 'utf8')).length, 21);
});

test('admin authentication is required for every mutation and for reading bookings', async () => {
  for (const [route, body] of [
    ['/api/admin/bookings', undefined], ['/api/admin/bookings', input()],
    ['/api/admin/bookings/status', { bookingId: 'x', status: 'cancelled' }],
    ['/api/admin/bookings/delete', { bookingId: 'x' }],
    ['/api/settings', { studioAddress: 'Test' }], ['/api/settings/logo', { logoUrl: '' }],
  ]) assert.equal((await request(route, body)).status, 401, route);
});

test('invalid dates and out-of-schedule times are rejected', async () => {
  for (const slot of ['09:30', '20:30', '10:15']) {
    assert.equal((await request('/api/admin/bookings', input(slot), true)).status, 400);
  }
  assert.equal((await request('/api/admin/bookings', input('10:30', { date: '2030-02-30' }), true)).status, 400);
  assert.equal((await request('/api/admin/bookings', input('10:30', { photoshootType: 'invalid' }), true)).status, 400);
});

test('cancellation frees exactly one slot; reactivation cannot overwrite another booking', async () => {
  const a = (await request('/api/admin/bookings', input('10:00'), true)).data.booking;
  const b = (await request('/api/admin/bookings', input('10:30', { clientName: 'İkinci Müştəri', clientPhone: '+994 51 123 45 67' }), true)).data.booking;
  assert.equal((await request('/api/admin/bookings/status', { bookingId: a.id, status: 'cancelled' }, true)).status, 200);
  assert.deepEqual((await request('/api/availability')).data.bookedSlots.map(s => s.timeSlot), ['10:30']);
  await request('/api/admin/bookings', input('10:00'), true);
  assert.equal((await request('/api/admin/bookings/status', { bookingId: a.id, status: 'confirmed' }, true)).status, 409);
  const complete = await request('/api/admin/bookings/status', { bookingId: b.id, status: 'completed' }, true);
  assert.ok(complete.data.booking.completedAt);
  const restored = await request('/api/admin/bookings/status', { bookingId: b.id, status: 'confirmed' }, true);
  assert.equal(restored.data.booking.completedAt, undefined);
  assert.equal(restored.data.booking.cancelledBy, null);
  assert.equal((await request('/api/admin/bookings/delete', { bookingId: b.id }, true)).status, 200);
  assert.equal((await request('/api/admin/bookings/delete', { bookingId: b.id }, true)).status, 404);
});

test('only a valid customer secret can cancel a customer booking', async () => {
  const booking = (await request('/api/bookings', input())).data.booking;
  assert.equal((await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: 'wrong' })).status, 403);
  assert.equal((await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret })).status, 200);
  assert.equal((await request('/api/availability')).data.bookedSlots.length, 0);
});

test('the uploaded JPG passes the logo route size limit and reset persists', async () => {
  const logoUrl = 'data:image/jpeg;base64,' + readFileSync(path.join(project, 'src/assets/images/emgraphic-logo.jpg')).toString('base64');
  assert.equal((await request('/api/settings/logo', { logoUrl }, true)).status, 200);
  assert.equal((await request('/api/settings/logo')).data.logoUrl, logoUrl);
  assert.equal((await request('/api/settings/logo', { logoUrl: '' }, true)).status, 200);
  assert.equal((await request('/api/settings/logo')).data.logoUrl, null);
  assert.equal((await request('/api/settings/logo', { logoUrl: 'javascript:bad' }, true)).status, 400);
});

test('contact settings persist and repeated admin reads do not block mutations', async () => {
  assert.equal((await request('/api/settings', { studioAddress: 'Yeni studiya ünvanı', whatsappNumber: '+994 55 111 22 33' }, true)).status, 200);
  assert.equal((await request('/api/settings')).data.settings.studioAddress, 'Yeni studiya ünvanı');
  for (let i = 0; i < 125; i++) assert.equal((await request('/api/admin/bookings', undefined, true)).status, 200);
  assert.equal((await request('/api/admin/bookings', input(), true)).status, 200);
});

test('unknown API routes and unreadable storage report an error instead of false success', async () => {
  assert.equal((await request('/api/missing')).status, 404);
  writeFileSync(path.join(dataDir, 'bookings.json'), 'corrupt');
  assert.equal((await request('/api/admin/bookings', undefined, true)).status, 500);
  assert.equal((await request('/api/admin/bookings', input(), true)).status, 500);
  assert.equal(readFileSync(path.join(dataDir, 'bookings.json'), 'utf8'), 'corrupt');
});

test('live events announce customer creation and cancellation without private records', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(base + '/api/events', { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /^text\/event-stream(;|$)/);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const nextUpdate = async () => {
    let text = '';
    while (!text.includes('event: update')) {
      const part = await reader.read();
      if (part.done) throw new Error('Stream closed before update');
      text += decoder.decode(part.value);
    }
    const json = text.split('\n').find(line => line.startsWith('data: '));
    const event = JSON.parse(json.slice(6));
    assert.deepEqual(Object.keys(event), ['revision']);
    assert.ok(!text.includes('clientName') && !text.includes('clientSecret') && !text.includes('clientPhone'));
    return event.revision;
  };
  try {
    const created = await request('/api/bookings', input('11:30'));
    assert.equal(created.status, 200);
    const first = await nextUpdate();
    const booking = created.data.booking;
    assert.equal((await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret })).status, 200);
    assert.ok(await nextUpdate() > first);
  } finally { clearTimeout(timeout); await reader.cancel(); controller.abort(); }
});

test('checked-in sessions still reserve their slot and cannot be cancelled by a customer', async () => {
  const booking = (await request('/api/admin/bookings', input(), true)).data.booking;
  writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([{ ...booking, status: 'checked_in', checkedInAt: new Date().toISOString() }]));
  assert.equal((await request('/api/availability')).data.bookedSlots.length, 1);
  assert.equal((await request('/api/bookings', input('10:30', { clientPhone: '+994 55 987 65 43' }))).status, 409);
  assert.equal((await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret })).status, 400);
  assert.equal((await request('/api/admin/bookings/status', { bookingId: booking.id, status: 'checked_in' }, true)).status, 400);
});

test('elapsed sessions auto-close on reads and optional no-show corrections stay distinct from cancellations', async () => {
  const arrived = { ...(await request('/api/admin/bookings', input(), true)).data.booking, date: futureDate(-1), status: 'checked_in' };
  const unknown = { ...arrived, id: 'unreviewed', referenceCode: 'EM-REVIEW', status: 'confirmed' };
  writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([arrived, unknown]));
  const records = (await request('/api/admin/bookings', undefined, true)).data.bookings;
  assert.equal(records[0].status, 'completed');
  assert.equal(records[0].completionSource, 'automatic');
  assert.equal(records[1].status, 'completed');
  assert.equal(records[1].completionSource, 'automatic');
  const noShow = await request('/api/admin/bookings/status', { bookingId: unknown.id, status: 'no_show', expectedStatus: 'completed' }, true);
  assert.equal(noShow.status, 200);
  assert.ok(noShow.data.booking.noShowAt);
  assert.equal(noShow.data.booking.cancelledBy, null);
  assert.equal(noShow.data.booking.completedAt, undefined);
  const future = (await request('/api/admin/bookings', input('12:30'), true)).data.booking;
  assert.equal((await request('/api/admin/bookings/status', { bookingId: future.id, status: 'no_show' }, true)).status, 400);
});

test('automatic closure releases customer identity limits without reopening cancelled or no-show slots', async () => {
  const old = (await request('/api/admin/bookings', input('10:30'), true)).data.booking;
  writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([{ ...old, date: futureDate(-1) }]));
  const created = await request('/api/bookings', input('11:30'));
  assert.equal(created.status, 200);
  const records = (await request('/api/admin/bookings', undefined, true)).data.bookings;
  assert.equal(records.find(b => b.id === old.id).status, 'completed');
  assert.equal(records.find(b => b.id === old.id).completionSource, 'automatic');
  assert.deepEqual((await request('/api/availability')).data.bookedSlots, [{ date: created.data.booking.date, timeSlot: '11:30' }]);
});
test('a stale admin action cannot overwrite a cancellation arriving from the customer', async () => {
  const booking = (await request('/api/bookings', input('13:00'))).data.booking;
  await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret });
  const stale = await request('/api/admin/bookings/status', { bookingId: booking.id, status: 'completed', expectedStatus: 'confirmed' }, true);
  assert.equal(stale.status, 409);
  const saved = (await request('/api/admin/bookings', undefined, true)).data.bookings[0];
  assert.equal(saved.status, 'cancelled');
  assert.equal(saved.cancelledBy, 'client');
});

test('server allows client cancellation inside the final two hours and rejects it only after the start', async () => {
  const booking = (await request('/api/admin/bookings', input('16:00'), true)).data.booking;
  const seed = minutes => {
    const local = new Date(Date.now() + minutes * 60000 + 4 * 3600000).toISOString();
    const record = { ...booking, date: local.slice(0, 10), timeSlot: local.slice(11, 16) };
    writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([record]));
    return record;
  };
  for (const minutes of [121, 119, 5]) {
    seed(minutes);
    assert.equal((await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret })).status, 200);
    assert.deepEqual((await request('/api/availability')).data.bookedSlots, []);
  }
  const imminent = seed(-1);
  const rejected = await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret });
  assert.equal(rejected.status, 400); assert.equal(rejected.data.errorCode, 'CANCELLATION_DEADLINE_PASSED');
  assert.equal((await request('/api/admin/bookings', undefined, true)).data.bookings[0].status, 'confirmed');
  assert.deepEqual((await request('/api/availability')).data.bookedSlots, [{ date: imminent.date, timeSlot: imminent.timeSlot }]);
  assert.equal((await request('/api/admin/bookings/status', { bookingId: booking.id, status: 'cancelled' }, true)).status, 200);
  assert.deepEqual((await request('/api/availability')).data.bookedSlots, []);
});
test('a customer cannot retroactively cancel an unattended appointment after its start', async () => {
  const booking = (await request('/api/admin/bookings', input('14:00'), true)).data.booking;
  writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([{ ...booking, date: futureDate(-1) }]));
  const result = await request('/api/bookings/cancel', { bookingId: booking.id, clientSecret: booking.clientSecret });
  assert.equal(result.status, 400);
  assert.equal((await request('/api/admin/bookings', undefined, true)).data.bookings[0].status, 'completed');
});

test('the server automatically finishes all elapsed sessions with every browser closed', { timeout: 18000 }, async () => {
  const source = (await request('/api/admin/bookings', input('15:00'), true)).data.booking;
  const arrived = { ...source, date: futureDate(-1), status: 'checked_in', checkedInAt: new Date().toISOString() };
  const pending = { ...arrived, id: 'still-unreviewed', status: 'confirmed' };
  writeFileSync(path.join(dataDir, 'bookings.json'), JSON.stringify([arrived, pending]));
  // Deliberately make no HTTP reads: the background timer must persist the change.
  const deadline = Date.now() + 16000;
  let records;
  do {
    await new Promise(resolve => setTimeout(resolve, 300));
    records = JSON.parse(readFileSync(path.join(dataDir, 'bookings.json'), 'utf8'));
    if (records[0].status === 'completed') break;
  } while (Date.now() < deadline);
  assert.equal(records[0].status, 'completed');
  assert.equal(records[0].completionSource, 'automatic');
  assert.equal(records[1].status, 'completed');
  assert.equal(records[1].completionSource, 'automatic');
});
