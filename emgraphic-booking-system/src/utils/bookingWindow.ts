export const MAX_BOOKING_ADVANCE_DAYS = 90;

export function getLastBookableDate(nowMs = Date.now()): string {
  // Use calendar days in Baku, independently of the host/device timezone.
  const bakuDay = new Date(nowMs + 4 * 3600000).toISOString().slice(0, 10);
  const end = new Date(bakuDay + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + MAX_BOOKING_ADVANCE_DAYS);
  return end.toISOString().slice(0, 10);
}

export function isWithinBookingWindow(date: string, nowMs = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return false;
  const today = new Date(nowMs + 4 * 3600000).toISOString().slice(0, 10);
  return date >= today && date <= getLastBookableDate(nowMs);
}
