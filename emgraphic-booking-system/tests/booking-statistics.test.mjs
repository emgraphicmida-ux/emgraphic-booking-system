import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyBookingStats, isFinishedBooking } from '../src/utils/bookingStatistics.ts';

const record = (status, date = '2026-10-21', timeSlot = '10:00') => ({ status, date, timeSlot });
const now = Date.parse('2026-10-21T12:00:00+04:00');
test('monthly totals count elapsed bookings and both sources of cancellations by shoot month', () => {
  const records = [
    record('confirmed'), record('checked_in'), record('completed'),
    { ...record('cancelled'), cancelledBy: 'client' }, { ...record('cancelled'), cancelledBy: 'admin' },
    record('no_show'), record('confirmed', '2026-10-21', '14:00'),
    record('completed', '2026-09-15'), record('cancelled', '2026-09-15'),
    { ...record('completed'), createdAt: '2026-09-15T10:00:00Z' },
  ];
  assert.deepEqual(getMonthlyBookingStats(records, '2026-10', now), { shoots: 4, cancelled: 2 });
  assert.deepEqual(getMonthlyBookingStats(records, '2026-09', now), { shoots: 1, cancelled: 1 });
  assert.deepEqual(getMonthlyBookingStats(records, '2026-08', now), { shoots: 0, cancelled: 0 });
  assert.deepEqual(getMonthlyBookingStats(records, '2026-1', now), { shoots: 0, cancelled: 0 });
});
test('monthly totals change at the exact session end without a manual confirmation', () => {
  const booking = record('confirmed', '2026-10-31', '20:00');
  const end = Date.parse('2026-10-31T20:30:00+04:00');
  assert.deepEqual(getMonthlyBookingStats([booking], '2026-10', end - 1), { shoots: 0, cancelled: 0 });
  assert.deepEqual(getMonthlyBookingStats([booking], '2026-10', end), { shoots: 1, cancelled: 0 });
  assert.equal(isFinishedBooking({ ...booking, status: 'cancelled' }, end), false);
  assert.equal(isFinishedBooking({ ...booking, status: 'no_show' }, end), false);
});
