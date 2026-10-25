import type { Booking } from '../types/booking.js';
import { bookingStartsAt } from './attendance.js';

export const CANCELLATION_RULE = 'Qeydiyyatı çəkiliş başlayana qədər ləğv edə bilərsiniz.';
export const CANCELLATION_CLOSED_MESSAGE = 'Çəkilişin vaxtı artıq başlayıb. Bu qeydiyyatı ləğv etmək üçün studiya ilə əlaqə saxlayın.';

export function cancellationDeadline(booking: Pick<Booking, 'date' | 'timeSlot'>): number {
  return bookingStartsAt(booking);
}

export function canClientCancelBooking(booking: Pick<Booking, 'date' | 'timeSlot' | 'status'>, now = Date.now()): boolean {
  return booking.status === 'confirmed' && now < cancellationDeadline(booking);
}
