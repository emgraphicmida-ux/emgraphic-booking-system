import { ALL_TIME_SLOTS } from '../types/booking.js';

// The last bookable session starts at 20:00 and finishes at 20:30.
export const STUDIO_END_TIMES = [...ALL_TIME_SLOTS.slice(1), '20:30'];

export function studioRangeSlots(start: unknown, end: unknown): string[] | null {
  if (typeof start !== 'string' || typeof end !== 'string' || !ALL_TIME_SLOTS.includes(start) || !STUDIO_END_TIMES.includes(end) || start >= end) return null;
  return ALL_TIME_SLOTS.filter(slot => slot >= start && slot < end);
}

export function formatStudioRanges(slots: string[]): string {
  const endpoints = [...ALL_TIME_SLOTS, '20:30'];
  const indexes = ALL_TIME_SLOTS.map((slot, index) => slots.includes(slot) ? index : -1).filter(index => index >= 0);
  const ranges: string[] = [];
  for (let i = 0; i < indexes.length; i++) {
    const first = indexes[i];
    while (i + 1 < indexes.length && indexes[i + 1] === indexes[i] + 1) i++;
    ranges.push(endpoints[first] + '–' + endpoints[indexes[i] + 1]);
  }
  return ranges.join(' · ');
}
