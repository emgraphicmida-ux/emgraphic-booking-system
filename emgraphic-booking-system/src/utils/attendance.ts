import type { Booking } from '../types/booking';

export const SESSION_MINUTES = 30;

export function bookingStartsAt(booking: Pick<Booking, 'date' | 'timeSlot'>): number {
  const slot = booking.timeSlot.match(/^(\d{1,2}):(\d{2})/);
  if (!slot) return NaN;
  return Date.parse(booking.date + 'T' + slot[1].padStart(2, '0') + ':' + slot[2] + ':00+04:00');
}

export function bookingEndsAt(booking: Pick<Booking, 'date' | 'timeSlot'>): number {
  return bookingStartsAt(booking) + SESSION_MINUTES * 60_000;
}

export function isActiveBooking(booking: Pick<Booking, 'status'>): boolean {
  return booking.status === 'confirmed' || booking.status === 'checked_in';
}

// Close every elapsed active session by schedule; attendance exceptions remain explicit.
export function finishElapsedBookings(bookings: Booking[], now = Date.now()): boolean {
  let changed = false;
  for (const booking of bookings) {
    if (isActiveBooking(booking) && bookingEndsAt(booking) <= now) {
      booking.status = 'completed';
      booking.completedAt = new Date(bookingEndsAt(booking)).toISOString();
      booking.completionSource = 'automatic';
      changed = true;
    }
  }
  return changed;
}
