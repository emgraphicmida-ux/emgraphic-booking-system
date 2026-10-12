/**
 * Studio Booking Rules & Advance Notice Policies
 * Emgraphic Studio policy: Clients must book in advance (Öncədən yazılmaq lazımdır).
 * All rules strictly evaluated based on official Baku Time (Asia/Baku, UTC+4).
 */

import { ALL_TIME_SLOTS, isSameOrMatchingSlot } from '../types/booking';
import { getBakuNowDetails } from './bakuTime';

/**
 * Minimum advance notice required in hours before a slot starts (2 hours).
 * Emgraphic Studio qaydası: Çəkilişə ən azı 2 saat öncədən yazılmaq lazımdır.
 */
export const MIN_ADVANCE_NOTICE_HOURS = 2;

/**
 * Parses the start hour from a slot string.
 * Example: "14:00 - 14:30" -> 14
 */
export function getSlotStartHour(slot: string): number {
  const match = slot.match(/^(\d{1,2}):/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parses the exact decimal start hour from a slot string with minute precision.
 * Example: "10:30 - 11:00" -> 10.5
 */
export function getSlotStartDecimalHour(slot: string): number {
  const match = slot.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours + minutes / 60;
}

/**
 * Checks if a specific date and time slot can be booked in advance strictly according to Baku time.
 * @param dateStr - Target date in YYYY-MM-DD
 * @param slot - Time slot string (e.g. "10:00 - 10:30")
 * @param minAdvanceHours - Required buffer in hours (defaults to 0)
 */
export function checkSlotAdvanceStatus(
  dateStr: string,
  slot: string,
  minAdvanceHours = MIN_ADVANCE_NOTICE_HOURS
): {
  isBookable: boolean;
  status: 'available' | 'past' | 'insufficient_advance';
  label?: string;
} {
  const baku = getBakuNowDetails();
  const todayBakuStr = baku.dateStr;

  // Past dates in Baku are not bookable
  if (dateStr < todayBakuStr) {
    return {
      isBookable: false,
      status: 'past',
      label: 'Vaxtı keçib',
    };
  }

  // Future dates in Baku are bookable
  if (dateStr > todayBakuStr) {
    return {
      isBookable: true,
      status: 'available',
    };
  }

  // For TODAY in Baku: check against current Baku time with 30-min precision
  const slotStartDecimal = getSlotStartDecimalHour(slot);
  const currentBakuDecimalHour = baku.decimalHour;

  // If slot start time is less than or equal to current time, it is in the past
  if (slotStartDecimal <= currentBakuDecimalHour) {
    return {
      isBookable: false,
      status: 'past',
      label: 'Vaxtı keçib',
    };
  }

  if (minAdvanceHours > 0 && slotStartDecimal < currentBakuDecimalHour + minAdvanceHours) {
    return {
      isBookable: false,
      status: 'insufficient_advance',
      label: 'Ən azı 2 saat öncədən',
    };
  }

  return {
    isBookable: true,
    status: 'available',
  };
}

/**
 * Returns available bookable slots for a date considering both:
 * 1. Already booked slots
 * 2. Advance booking requirement according to Baku time (cannot book past/imminent hours)
 */
export function getBookableSlotsForDate(
  dateStr: string,
  bookedSlotsOnDate: string[],
  minAdvanceHours = MIN_ADVANCE_NOTICE_HOURS
): string[] {
  return ALL_TIME_SLOTS.filter((slot) => {
    // 1. Not already booked
    if (bookedSlotsOnDate.some((b) => isSameOrMatchingSlot(b, slot))) return false;

    // 2. Satisfies advance notice in Baku time
    const advance = checkSlotAdvanceStatus(dateStr, slot, minAdvanceHours);
    return advance.isBookable;
  });
}
