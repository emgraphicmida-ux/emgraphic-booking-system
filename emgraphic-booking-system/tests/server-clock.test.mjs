import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncedClock, getNowMs } from '../src/utils/clock.ts';
import { getBakuNowDetails } from '../src/utils/bakuTime.ts';
import { checkSlotAdvanceStatus } from '../src/utils/bookingRules.ts';
import { getMonthlyBookingStats } from '../src/utils/bookingStatistics.ts';

test('server clock accounts for network latency and ignores later device wall-clock changes', () => {
  let monotonic = 140, deviceWall = Date.parse('2040-01-01T00:00:00Z');
  const clock = createSyncedClock(() => monotonic, () => deviceWall);
  assert.equal(clock.now(), deviceWall);
  const server = Date.parse('2026-10-25T06:00:00Z');
  clock.synchronize(server, 100, 140);
  assert.equal(clock.now(), server + 20);
  deviceWall = Date.parse('2001-01-01T00:00:00Z');
  monotonic += 2000;
  assert.equal(clock.now(), server + 2020);
  assert.equal(getBakuNowDetails(new Date(clock.now())).dateStr, '2026-10-25');
  assert.equal(clock.synchronized(), true);
});

test('bad or excessively delayed server samples cannot replace the last synchronized time', () => {
  let monotonic = 50;
  const clock = createSyncedClock(() => monotonic, () => 1);
  clock.synchronize(100000, 20, 50);
  const baseline = clock.now();
  for (const sample of [[NaN, 0, 5], [Infinity, 0, 5], [9000000000000000, 0, 5], [100, 10, 5], [100, 0, 30001]]) {
    assert.throws(() => clock.synchronize(...sample));
    assert.equal(clock.now(), baseline);
  }
});

test('the same synchronized time drives exact booking boundaries and monthly shoot totals', () => {
  let monotonic = 10;
  const clock = createSyncedClock(() => monotonic, () => Date.parse('2040-01-01T00:00:00Z'));
  const now = Date.parse('2026-10-25T14:00:00+04:00');
  clock.synchronize(now, 10, 10);
  assert.equal(checkSlotAdvanceStatus('2026-10-25', '14:30', undefined, new Date(clock.now())).isBookable, true);
  monotonic += 1;
  assert.equal(checkSlotAdvanceStatus('2026-10-25', '14:30', undefined, new Date(clock.now())).isBookable, false);
  const booking = { date: '2026-10-25', timeSlot: '14:00', status: 'confirmed' };
  assert.deepEqual(getMonthlyBookingStats([booking], '2026-10', clock.now()), { shoots: 0, cancelled: 0 });
  monotonic += 30 * 60000;
  assert.deepEqual(getMonthlyBookingStats([booking], '2026-10', clock.now()), { shoots: 1, cancelled: 0 });
});

test('server-side consumers use the server wall clock and never need browser synchronization', () => {
  const before = Date.now();
  const now = getNowMs();
  assert.ok(now >= before && now <= Date.now());
});
