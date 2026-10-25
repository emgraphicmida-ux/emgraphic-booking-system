import { isFinishedBooking } from '../src/utils/bookingStatistics.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingStartsAt, bookingEndsAt, finishElapsedBookings } from '../src/utils/attendance.ts';

const booking = (status) => ({ id: status, status, date: '2026-10-17', timeSlot: '10:30', clientName: 'Test' });
const start = Date.parse('2026-10-17T10:30:00+04:00');
const end = Date.parse('2026-10-17T11:00:00+04:00');

test('half-hour sessions use Baku time, including legacy time strings', () => {
  assert.equal(bookingStartsAt(booking('confirmed')), start);
  assert.equal(bookingEndsAt(booking('confirmed')), end);
  assert.equal(bookingEndsAt({ ...booking('confirmed'), timeSlot: '20:00' }), Date.parse('2026-10-17T20:30:00+04:00'));
  assert.equal(bookingStartsAt({ ...booking('confirmed'), timeSlot: '10:30 - 11:00' }), start);
});

test('every elapsed active booking completes automatically without staff confirmation', () => {
  const records = [booking('checked_in'), booking('confirmed'), booking('cancelled'), booking('no_show')];
  assert.equal(finishElapsedBookings(records, end - 1), false);
  assert.equal(finishElapsedBookings(records, end), true);
  assert.deepEqual(records.map(b => b.status), ['completed', 'completed', 'cancelled', 'no_show']);
  assert.equal(records[0].completionSource, 'automatic');
  assert.equal(records[0].completedAt, new Date(end).toISOString());
  assert.equal(records[1].completionSource, 'automatic');
  assert.equal(records[1].completedAt, new Date(end).toISOString());
  assert.equal(finishElapsedBookings(records, end + 86400000), false);
});

test('finished booking totals require an elapsed non-cancelled session', () => {
  const planned = booking('confirmed');
  assert.equal(isFinishedBooking(planned, start - 1), false);
  assert.equal(isFinishedBooking(planned, end - 1), false);
  assert.equal(isFinishedBooking(planned, end), true);
  assert.equal(isFinishedBooking(booking('cancelled'), end), false);
  assert.equal(isFinishedBooking(booking('no_show'), end), false);
  assert.equal(isFinishedBooking({ ...planned, timeSlot: 'invalid' }, end), false);
});
