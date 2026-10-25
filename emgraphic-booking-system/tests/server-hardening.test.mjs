import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = path.resolve(tmpdir());
const dataDir = mkdtempSync(path.join(temporaryRoot, 'emgraphic-hardening-test-'));
const adminKey = randomUUID();
let server, base, logs = '';
before(async () => {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, ['server.js'], {
    cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production',
      DATA_DIR: dataDir, ADMIN_KEY: adminKey, TRUST_PROXY: 'loopback' },
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/api/time')).ok) return; } catch {}
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Isolated hardening server did not start: ' + logs);
});
after(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill(); await stopped;
  }
  if (path.dirname(dataDir) !== temporaryRoot || !path.basename(dataDir).startsWith('emgraphic-hardening-test-')) throw new Error('Invalid cleanup target');
  rmSync(dataDir, { recursive: true, force: true });
});

test('production responses prevent framing and restrict scripts without blocking local resources', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.match(csp, /connect-src 'self'/);
});

test('ordinary compressed JSON is rejected safely without stopping the server', async () => {
  const response = await fetch(base + '/api/my-active-booking', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    body: gzipSync(JSON.stringify({ tokens: [] })),
  });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).success, false);
  assert.equal((await fetch(base + '/api/time')).status, 200);
});

test('logo upload authenticates before parsing malformed bodies and bounds authorized uploads', async () => {
  const rejected = await fetch(base + '/api/settings/logo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json'.repeat(9000),
  });
  assert.equal(rejected.status, 401, 'unauthenticated invalid input must not reach the JSON parser');
  const otherMethod = await fetch(base + '/api/settings/logo', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(60 * 1024) }),
  });
  assert.equal(otherMethod.status, 413, 'non-upload methods must retain the ordinary 50KB body limit');
  const oversized = await fetch(base + '/api/settings/logo', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ logoUrl: 'data:image/png;base64,' + 'A'.repeat(12 * 1024 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal(existsSync(path.join(dataDir, 'logo.json')), false);
});

test('HTTPS upgrades an existing device cookie without changing its ownership token', async () => {
  const initial = await fetch(base + '/api/time');
  const firstCookie = initial.headers.get('set-cookie');
  assert.ok(firstCookie);
  assert.doesNotMatch(firstCookie, /;\s*Secure\b/i);
  const ownerCookie = firstCookie.split(';')[0];
  const secured = await fetch(base + '/api/time', { headers: { Cookie: ownerCookie, 'X-Forwarded-Proto': 'https' } });
  const upgradedCookie = secured.headers.get('set-cookie');
  assert.ok(upgradedCookie);
  assert.equal(upgradedCookie.split(';')[0], ownerCookie);
  assert.match(upgradedCookie, /;\s*Secure\b/i);
  assert.match(upgradedCookie, /;\s*HttpOnly\b/i);
  assert.match(upgradedCookie, /;\s*SameSite=Lax\b/i);
  assert.match(secured.headers.get('strict-transport-security'), /max-age=/);
});

test('public SSE streams enforce the per-IP cap and release a closed connection', async () => {
  const opened = [];
  try {
    for (let index = 0; index < 16; index++) {
      const abort = new AbortController();
      const response = await fetch(base + '/api/events', { signal: abort.signal });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/event-stream/);
      opened.push({ abort, response });
    }
    const overflow = await fetch(base + '/api/events');
    assert.equal(overflow.status, 429);
    assert.equal(overflow.headers.get('retry-after'), '30');
    await overflow.json();
    opened[0].abort.abort();
    let replacement;
    for (let attempt = 0; attempt < 30; attempt++) {
      const abort = new AbortController();
      const response = await fetch(base + '/api/events', { signal: abort.signal });
      if (response.status === 200) { replacement = { abort, response }; opened.push(replacement); break; }
      assert.equal(response.status, 429);
      await response.json();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(replacement, 'closing one stream must restore one connection slot');
  } finally {
    for (const entry of opened) entry.abort.abort();
  }
});

test('unreadable settings report an error and cannot be silently replaced with defaults', async () => {
  const settingsFile = path.join(dataDir, 'settings.json');
  const original = readFileSync(settingsFile, 'utf8');
  try {
    writeFileSync(settingsFile, '{invalid-settings-json');
    const failedRead = await fetch(base + '/api/settings');
    assert.equal(failedRead.status, 500);
    assert.equal((await failedRead.json()).success, false);
    const failedWrite = await fetch(base + '/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ studioAddress: 'Yeni sınaq ünvanı' }),
    });
    assert.equal(failedWrite.status, 500);
    assert.equal(readFileSync(settingsFile, 'utf8'), '{invalid-settings-json');
  } finally { writeFileSync(settingsFile, original); }
  assert.equal((await fetch(base + '/api/settings')).status, 200);
});

test('booking API rejects invalid and oversized phones and remote dates, while preserving a valid local 99 number', async () => {
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const input = {
    clientName: 'Nömrə Qoruması Sınağı', clientPhone: '+994 99 412 34 56',
    photoshootType: '1 dekor (20-25 kadr fotoşəkil)', date, timeSlot: '19:30',
  };
  const create = overrides => fetch(base + '/api/admin/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ ...input, ...overrides }),
  });
  for (const overrides of [
    { clientPhone: '000000000' },
    { clientPhone: '50' + ' '.repeat(40) + '1234567' },
    { date: '9999-01-01' },
  ]) {
    const rejected = await create(overrides);
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).success, false);
  }
  assert.deepEqual(JSON.parse(readFileSync(path.join(dataDir, 'bookings.json'), 'utf8')), [], 'rejected input must not create records');
  const accepted = await create({ clientPhone: '994123456' });
  assert.equal(accepted.status, 200);
  const result = await accepted.json();
  assert.equal(result.success, true);
  assert.equal(result.booking.clientPhone, '+994 99 412 34 56');
  const stored = JSON.parse(readFileSync(path.join(dataDir, 'bookings.json'), 'utf8'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].clientPhone, '+994 99 412 34 56');
});
