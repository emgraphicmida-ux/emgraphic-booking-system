import type { Booking } from '../types/booking.js';
import { bookingEndsAt } from './attendance.js';

export function isFinishedBooking(booking: Pick<Booking, 'date' | 'timeSlot' | 'status'>, now = Date.now()): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'no_show' && bookingEndsAt(booking) <= now;
}

export function getMonthlyBookingStats(bookings: Booking[], month: string, now = Date.now()) {
  let shoots = 0, cancelled = 0;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { shoots, cancelled };
  for (const booking of bookings) {
    if (!booking.date.startsWith(month + '-')) continue;
    if (booking.status === 'cancelled') cancelled++;
    else if (isFinishedBooking(booking, now)) shoots++;
  }
  return { shoots, cancelled };
}
