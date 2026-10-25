import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { checkSlotAdvanceStatus, MIN_ADVANCE_NOTICE_MINUTES } from '../src/utils/bookingRules.ts';

const date = '2026-11-12', slot = '14:30';
const at = time => new Date(date + 'T' + time + '+04:00');
test('30-minute booking notice includes the exact boundary and rejects any shorter notice', () => {
  assert.equal(MIN_ADVANCE_NOTICE_MINUTES, 30);
  assert.equal(checkSlotAdvanceStatus(date, slot, undefined, at('13:59:59.999')).isBookable, true);
  assert.equal(checkSlotAdvanceStatus(date, slot, undefined, at('14:00:00.000')).isBookable, true);
  assert.equal(checkSlotAdvanceStatus(date, slot, undefined, at('14:00:00.001')).status, 'insufficient_advance');
  assert.equal(checkSlotAdvanceStatus(date, slot, undefined, at('14:30:00.000')).status, 'past');
});
test('past days remain closed; future bookings and legacy half-hour strings still work', () => {
  assert.equal(checkSlotAdvanceStatus('2026-11-11', slot, undefined, at('14:00:00')).status, 'past');
  assert.equal(checkSlotAdvanceStatus('2026-11-13', '10:00', undefined, at('23:59:59')).isBookable, true);
  assert.equal(checkSlotAdvanceStatus(date, '14:30 - 15:00', undefined, at('14:00:00')).isBookable, true);
  assert.equal(checkSlotAdvanceStatus(date, 'invalid', undefined, at('14:00:00')).isBookable, false);
});
test('notice is measured across midnight in Baku time', () => {
  assert.equal(checkSlotAdvanceStatus('2026-11-13', '00:00', undefined, at('23:30:00')).isBookable, true);
  assert.equal(checkSlotAdvanceStatus('2026-11-13', '00:00', undefined, at('23:30:00.001')).status, 'insufficient_advance');
});
test('public API uses the same exact 30-minute boundary and keeps short-notice admin booking available', async () => {
  const root = path.resolve(tmpdir()), directory = mkdtempSync(path.join(root, 'emgraphic-notice-'));
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const key = 'test-only-admin-key';
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null && !child.killed) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  };
  try {
    for (const [time, expected] of [['13:59:59.999', 200], ['14:00:00.000', 200], ['14:00:00.001', 400]]) {
      await stop(); writeFileSync(path.join(directory, 'bookings.json'), '[]');
      const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
      const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
      const base = 'http://127.0.0.1:' + port;
      // Freeze only this isolated child process; production has no clock override setting.
      const clock = 'const NativeDate = Date; globalThis.Date = class extends NativeDate { constructor(...args) { if (args.length) super(...args); else super(' + at(time).getTime() + '); } static now() { return ' + at(time).getTime() + '; } };';
      child = spawn(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(clock), 'server.js'], { cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), NODE_ENV: 'production', DATA_DIR: directory, ADMIN_KEY: key, TRUST_PROXY: '' } });
      let logs = ''; child.stdout.on('data', c => logs += c); child.stderr.on('data', c => logs += c);
      for (let attempt = 0; ; attempt++) {
        try { if ((await fetch(base + '/api/time')).ok) break; } catch {}
        if (child.exitCode !== null || attempt > 80) throw new Error('Server startup failed: ' + logs);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      const input = { date, timeSlot: slot, clientName: 'Test Müştəri', clientPhone: '+994 50 123 45 67', photoshootType: '1 dekor (20-25 kadr fotoşəkil)' };
      const response = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      assert.equal(response.status, expected, time);
      if (expected === 400) {
        assert.match((await response.json()).error, /30 dəqiqə/);
        const admin = await fetch(base + '/api/admin/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify(input) });
        assert.equal(admin.status, 200);
      }
    }
  } finally {
    await stop();
    if (!directory.startsWith(root + path.sep) || !path.basename(directory).startsWith('emgraphic-notice-')) throw new Error('Unsafe cleanup path');
    rmSync(directory, { recursive: true, force: true });
  }
});
