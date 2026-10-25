import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cancellationDeadline, canClientCancelBooking } from '../src/utils/cancellation.ts';

const booking = { date: '2026-11-12', timeSlot: '16:00', status: 'confirmed' };
const cutoff = Date.parse('2026-11-12T16:00:00+04:00');

test('customer cancellation stays open in the final two hours, until the session starts', () => {
  assert.equal(cancellationDeadline(booking), cutoff);
  assert.equal(canClientCancelBooking(booking, cutoff - 1), true);
  assert.equal(canClientCancelBooking(booking, cutoff - 119 * 60000), true);
  assert.equal(canClientCancelBooking(booking, cutoff - 5 * 60000), true);
  assert.equal(canClientCancelBooking(booking, cutoff), false);
  assert.equal(canClientCancelBooking(booking, cutoff + 1), false);
  assert.equal(canClientCancelBooking(booking, cutoff + 2 * 3600000), false);
});
test('cancellation uses Baku timestamps across dates and supports legacy time strings', () => {
  const early = { ...booking, timeSlot: '01:30 - 02:00' };
  const previousDay = Date.parse('2026-11-11T23:30:00+04:00');
  const startsAt = Date.parse('2026-11-12T01:30:00+04:00');
  assert.equal(cancellationDeadline(early), startsAt);
  assert.equal(canClientCancelBooking(early, previousDay), true);
  assert.equal(canClientCancelBooking(early, startsAt - 1), true);
  assert.equal(canClientCancelBooking(early, startsAt), false);
});
test('checked-in and inactive bookings, or unreadable times, cannot be client-cancelled', () => {
  for (const status of ['checked_in', 'completed', 'cancelled', 'no_show']) assert.equal(canClientCancelBooking({ ...booking, status }, cutoff - 1), false);
  assert.equal(canClientCancelBooking({ ...booking, timeSlot: 'invalid' }, cutoff - 1), false);
});
