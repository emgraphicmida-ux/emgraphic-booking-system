import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { StudioBackups } from '../server/studio.ts';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(tmpdir()), key = randomUUID();
let child, directory, port, base, logs;
const date = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const booking = (slot = '12:00') => ({ clientName: 'Test Müştəri', clientPhone: '+994 50 123 45 67', date: date(), timeSlot: slot, photoshootType: '1 dekor (20-25 kadr fotoşəkil)' });
async function api(route, body, admin = true) {
  const response = await fetch(base + '/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-admin-key': key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function start() {
  logs = '';
  child = spawn(process.execPath, ['server.js'], { cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DATA_DIR: directory, ADMIN_KEY: key, TRUST_PROXY: '' } });
  child.stdout.on('data', c => logs += c); child.stderr.on('data', c => logs += c);
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/time')).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(logs);
}
async function stop() { if (child && child.exitCode === null && child.signalCode === null && !child.killed) { const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done; } }
beforeEach(async () => {
  directory = mkdtempSync(path.join(root, 'emgraphic-studio-'));
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  port = probe.address().port; await new Promise(resolve => probe.close(resolve)); base = 'http://127.0.0.1:' + port;
  await start();
});
afterEach(async () => {
  await stop();
  if (!directory.startsWith(root + path.sep) || !path.basename(directory).startsWith('emgraphic-studio-')) throw new Error('Unsafe cleanup path');
  rmSync(directory, { recursive: true, force: true });
});

test('studio controls and backups require admin authentication, exports stay private', async () => {
  for (const route of ['admin/studio-blocks', 'admin/backups']) {
    assert.equal((await api(route, undefined, false)).status, 401);
    assert.equal((await api(route, {}, false)).status, 401);
  }
  const copy = (await api('admin/backups')).data.backups[0];
  assert.equal((await api('admin/backups/' + copy.id + '/download', undefined, false)).status, 401);
  assert.equal((await api('admin/backups/' + copy.id + '/restore', { confirmId: copy.id }, false)).status, 401);
  assert.equal((await api('admin/backups/' + copy.id + '/download')).headers.get('cache-control').includes('no-store'), true);
});
test('multiple studio slots are public only as occupancy and block public/manual bookings until released', async () => {
  const blocked = await api('admin/studio-blocks', { date: date(), timeSlots: ['10:30', '10:00', '20:00'], reason: 'Vinetka: gizli məktəb qeydi' });
  assert.equal(blocked.status, 200);
  const available = (await api('availability', undefined, false)).data.bookedSlots;
  assert.deepEqual(available, ['10:00', '10:30', '20:00'].map(timeSlot => ({ date: date(), timeSlot })));
  assert.equal(JSON.stringify(available).includes('məktəb'), false);
  assert.equal((await api('bookings', booking('10:30'), false)).status, 409);
  assert.equal((await api('admin/bookings', booking('10:30'))).status, 409);
  assert.equal((await api('admin/studio-blocks/delete', { id: blocked.data.block.id })).status, 200);
  assert.equal((await api('bookings', booking('10:30'), false)).status, 200);
});
test('a 12:00–16:00 range closes all eight sessions, preserves boundaries and supports the final session', async () => {
  const blocked = await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00', reason: 'Vinetka' });
  assert.equal(blocked.status, 200);
  const expected = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];
  assert.deepEqual(blocked.data.block.timeSlots, expected);
  assert.deepEqual((await api('availability')).data.bookedSlots.map(s => s.timeSlot), expected);
  for (const slot of ['12:00', '13:30', '15:30']) assert.equal((await api('bookings', booking(slot), false)).status, 409);
  assert.equal((await api('admin/bookings', booking('16:00'))).status, 200);
  assert.equal((await api('admin/studio-blocks', { date: date(), startTime: '20:00', endTime: '20:30' })).status, 200);
  assert.equal((await api('bookings', booking('20:00'), false)).status, 409);
});
test('invalid, partial and overlapping ranges fail without partially closing the day', async () => {
  for (const range of [
    { startTime: '16:00', endTime: '12:00' }, { startTime: '12:00', endTime: '12:00' },
    { startTime: '12:15', endTime: '16:00' }, { startTime: '12:00' },
    { startTime: '12:00', endTime: '21:00' }, { startTime: '12:00', endTime: '16:00', timeSlots: ['17:00'] },
  ]) assert.equal((await api('admin/studio-blocks', { date: date(), ...range })).status, 400);
  assert.equal((await api('admin/bookings', booking('15:30'))).status, 200);
  assert.equal((await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00' })).status, 409);
  assert.deepEqual((await api('admin/studio-blocks')).data.blocks, []);
});
test('blocking is all-or-nothing and never overwrites an active customer booking', async () => {
  const created = await api('admin/bookings', booking()); assert.equal(created.status, 200);
  const conflict = await api('admin/studio-blocks', { date: date(), timeSlots: ['11:30', '12:00'], reason: 'Vinetka' });
  assert.equal(conflict.status, 409);
  assert.deepEqual((await api('admin/studio-blocks')).data.blocks, []);
  assert.equal((await api('admin/bookings')).data.bookings[0].status, 'confirmed');
  await api('admin/bookings/status', { bookingId: created.data.booking.id, status: 'cancelled' });
  assert.equal((await api('admin/studio-blocks', { date: date(), timeSlots: ['12:00'] })).status, 200);
  assert.equal((await api('admin/bookings/status', { bookingId: created.data.booking.id, status: 'confirmed' })).status, 409);
});

const vinetkaGroup = (overrides = {}) => ({ schoolName: '  10   nömrəli məktəb ', className: ' 11 A ', studentCount: 25, contactName: ' Leyla   Əliyeva ', contactPhone: '0501234567', ...overrides });
test('vinetka group details are normalized, saved with a range and never exposed in public availability', async () => {
  const created = await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00', group: vinetkaGroup() });
  assert.equal(created.status, 200);
  assert.deepEqual(created.data.block.group, { schoolName: '10 nömrəli məktəb', className: '11 A', studentCount: 25, contactName: 'Leyla Əliyeva', contactPhone: '+994501234567' });
  const available = await api('availability', undefined, false);
  assert.equal(available.data.bookedSlots.length, 8);
  for (const slot of available.data.bookedSlots) assert.deepEqual(Object.keys(slot).sort(), ['date', 'timeSlot']);
  assert.equal(JSON.stringify(available.data).includes('Leyla'), false);
  assert.equal((await api('admin/studio-blocks', undefined, false)).status, 401);
  await stop(); await start();
  assert.deepEqual((await api('admin/studio-blocks')).data.blocks[0].group, created.data.block.group);
});
test('invalid and incomplete group details cannot close studio hours or overwrite saved details', async () => {
  for (const group of [null, [], {}, vinetkaGroup({ schoolName: '' }), vinetkaGroup({ className: 5 }), vinetkaGroup({ contactName: 'A' }), vinetkaGroup({ contactPhone: '123' }), vinetkaGroup({ studentCount: 0 }), vinetkaGroup({ studentCount: 2.5 }), vinetkaGroup({ studentCount: '25' }), vinetkaGroup({ studentCount: 2001 })]) {
    const result = await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00', group });
    assert.equal(result.status, 400);
  }
  assert.deepEqual((await api('admin/studio-blocks')).data.blocks, []);
  const block = (await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00', group: vinetkaGroup() })).data.block;
  assert.equal((await api('admin/studio-blocks/group', { id: block.id, expectedVersion: block.createdAt, group: vinetkaGroup({ studentCount: 0 }) })).status, 400);
  assert.deepEqual((await api('admin/studio-blocks')).data.blocks[0], block);
});
test('groups can be added to existing ranges, edited safely and recovered from backup without changing occupancy', async () => {
  const block = (await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00' })).data.block;
  const update = { id: block.id, expectedVersion: block.createdAt, group: vinetkaGroup() };
  assert.equal((await api('admin/studio-blocks/group', update, false)).status, 401);
  const added = await api('admin/studio-blocks/group', update);
  assert.equal(added.status, 200); assert.deepEqual(added.data.block.timeSlots, block.timeSlots);
  const copy = (await api('admin/backups', {})).data.backup;
  const edited = await api('admin/studio-blocks/group', { id: block.id, expectedVersion: added.data.block.updatedAt, group: vinetkaGroup({ studentCount: 30, contactPhone: '+994 55 765 43 21' }) });
  assert.equal(edited.status, 200); assert.equal(edited.data.block.group.studentCount, 30);
  assert.equal(edited.data.block.group.contactPhone, '+994557654321');
  assert.equal((await api('admin/studio-blocks/group', update)).status, 409);
  assert.equal((await api('admin/studio-blocks/group', { ...update, id: randomUUID() })).status, 404);
  await api('admin/backups/' + copy.id + '/restore', { confirmId: copy.id });
  const restored = (await api('admin/studio-blocks')).data.blocks[0];
  assert.deepEqual(restored.group, added.data.block.group);
  assert.deepEqual(restored.timeSlots, block.timeSlots);
  assert.equal((await api('availability')).data.bookedSlots.length, 8);
});
test('releasing a vinetka range frees bookings but keeps its group details and edit history', async () => {
  const block = (await api('admin/studio-blocks', { date: date(), startTime: '12:00', endTime: '16:00', group: vinetkaGroup() })).data.block;
  assert.equal((await api('admin/studio-blocks/delete', { id: block.id })).status, 200);
  const released = (await api('admin/studio-blocks')).data.blocks[0];
  assert.deepEqual(released.group, block.group); assert.ok(released.releasedAt); assert.ok(released.updatedAt);
  assert.deepEqual((await api('availability')).data.bookedSlots, []);
  assert.equal((await api('admin/bookings', booking('12:00'))).status, 200);
  assert.equal((await api('admin/studio-blocks/delete', { id: block.id })).status, 409);
  assert.equal((await api('admin/studio-blocks/group', { id: block.id, expectedVersion: block.createdAt, group: vinetkaGroup() })).status, 409);
  const updated = await api('admin/studio-blocks/group', { id: block.id, expectedVersion: released.updatedAt, group: vinetkaGroup({ studentCount: 26 }) });
  assert.equal(updated.status, 200); assert.equal(updated.data.block.group.studentCount, 26); assert.ok(updated.data.block.releasedAt);
  await stop(); await start();
  assert.deepEqual((await api('availability')).data.bookedSlots, [{ date: date(), timeSlot: '12:00' }]);
  assert.equal((await api('admin/studio-blocks')).data.blocks[0].group.studentCount, 26);
});
test('invalid dates/slots are rejected and blocks survive restart without closing other days', async () => {
  for (const data of [{ date: '2026-02-30', timeSlots: ['10:00'] }, { date: date(), timeSlots: ['20:30'] }, { date: date(), timeSlots: [] }, { date: date(), timeSlots: ['10:00'], reason: 42 }]) {
    assert.equal((await api('admin/studio-blocks', data)).status, 400);
  }
  await api('admin/studio-blocks', { date: date(), timeSlots: ['20:00'] });
  await stop(); await start();
  const slots = (await api('availability')).data.bookedSlots;
  assert.deepEqual(slots, [{ date: date(), timeSlot: '20:00' }]);
});
test('daily copies are unique per Baku day, including after restart and missed days', async () => {
  const first = (await api('admin/backups')).data.backups;
  assert.equal(first.length, 1); assert.equal(first[0].kind, 'daily');
  await stop(); await start();
  assert.equal((await api('admin/backups')).data.backups.length, 1);
  await stop();
  const manager = new StudioBackups(directory, readFileSync(path.join(directory, '.device-cookie-key'), 'utf8').trim(), () => {});
  const original = Date.now;
  try { Date.now = () => original() + 86400000; manager.ensureDaily(); manager.ensureDaily(); }
  finally { Date.now = original; }
  assert.equal(manager.list().filter(c => c.kind === 'daily').length, 2);
});
test('manual restore recovers bookings, settings, logo, and blocked slots with pre-restore safety copy', async () => {
  const created = (await api('admin/bookings', booking())).data.booking;
  await api('admin/studio-blocks', { date: date(), timeSlots: ['16:00', '16:30'], reason: 'Vinetka' });
  await api('settings', { studioAddress: 'Əvvəlki ünvan' });
  await api('settings/logo', { logoUrl: 'data:image/png;base64,YWJj' });
  const saved = (await api('admin/backups', {})).data.backup;
  const exported = (await api('admin/backups/' + saved.id + '/download')).data;
  assert.equal(exported.format, 'emgraphic-backup-v1');
  assert.equal(exported.snapshot.files['bookings.json'].includes(created.id), true);
  await api('admin/bookings/delete', { bookingId: created.id });
  assert.equal((await api('admin/backups')).data.backups.some(c => c.kind === 'before_delete' && c.bookingCount === 1), true);
  await api('settings', { studioAddress: 'Yeni ünvan' });
  await api('settings/logo', { logoUrl: '' });
  const block = (await api('admin/studio-blocks')).data.blocks[0];
  await api('admin/studio-blocks/delete', { id: block.id });
  assert.equal((await api('admin/backups/' + saved.id + '/restore', {})).status, 400);
  assert.equal((await api('admin/backups/' + saved.id + '/restore', { confirmId: saved.id })).status, 200);
  assert.equal((await api('admin/bookings')).data.bookings[0].id, created.id);
  assert.equal((await api('settings')).data.settings.studioAddress, 'Əvvəlki ünvan');
  assert.equal((await api('settings/logo')).data.logoUrl, 'data:image/png;base64,YWJj');
  assert.equal((await api('admin/studio-blocks')).data.blocks[0].id, block.id);
  assert.equal((await api('admin/backups')).data.backups.some(c => c.kind === 'before_restore' && c.bookingCount === 0), true);
  await stop(); await start();
  assert.equal((await api('admin/bookings')).data.bookings[0].id, created.id);
});
test('tampered snapshots are rejected without changing current data; IDs cannot escape backup folder', async () => {
  const saved = (await api('admin/backups', {})).data.backup;
  const file = path.join(directory, 'backups', saved.id + '.json');
  const envelope = JSON.parse(readFileSync(file, 'utf8'));
  envelope.payload = envelope.payload.replace('manual', 'tampered'); writeFileSync(file, JSON.stringify(envelope));
  const created = (await api('admin/bookings', booking())).data.booking;
  assert.equal((await api('admin/backups/' + saved.id + '/restore', { confirmId: saved.id })).status, 500);
  assert.equal((await api('admin/bookings')).data.bookings[0].id, created.id);
  assert.equal((await api('admin/backups')).data.backups.some(c => c.id === saved.id), false);
  assert.equal((await api('admin/backups/not-a-uuid/download')).status, 404);
  assert.equal((await api('admin/backups/..%5Csettings/download')).status, 404);
});
test('interrupted restore journal is recovered completely before next startup', async () => {
  const saved = (await api('admin/backups', {})).data.backup;
  await api('admin/bookings', booking());
  await stop();
  const raw = readFileSync(path.join(directory, 'backups', saved.id + '.json'), 'utf8');
  writeFileSync(path.join(directory, '.restore-pending.json'), raw);
  await start();
  assert.deepEqual((await api('admin/bookings')).data.bookings, []);
  assert.equal(readdirSync(directory).includes('.restore-pending.json'), false);
});
