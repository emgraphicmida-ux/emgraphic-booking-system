import { isFinishedBooking } from '../utils/bookingStatistics';
import type { Booking } from '../types/booking';
import { getBakuTodayStr } from '../utils/bakuTime';
import { getNowMs } from '../utils/clock';

// CSV is intended for viewing in Excel/Calc. Keep user-controlled cells as text,
// including phone numbers, and escape every field so separators cannot add cells.
export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '').replace(/\u0000/g, '');
  const safe = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text) ? '\t' + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function createBookingsCsv(bookings: Booking[], now = getNowMs()): string {
  const headers = [
    'Referans Kodu', 'Müştəri Adı və Soyadı', 'Əlaqə Nömrəsi', 'Çəkiliş Növü',
    'Tarix', 'Saat Aralığı', 'Status', 'Ləğv Edən Tərəf', 'Əlavə Qeydlər', 'Müraciət Tarixi',
  ];
  const rows = bookings.map(booking => {
    const status = booking.status === 'cancelled' ? 'Ləğv olundu' : isFinishedBooking(booking, now) ? 'Çəkiliş oldu' : '';
    const cancelledBy = booking.status !== 'cancelled' ? '-' : booking.cancelledBy === 'client'
      ? 'Müştəri ləğv etdi' : booking.cancelledBy === 'admin' ? 'Studiya ləğv etdi' : 'Ləğv edilib';
    return [booking.referenceCode, booking.clientName, booking.clientPhone, booking.photoshootType,
      booking.date, booking.timeSlot, status, cancelledBy, booking.notes || '',
      new Date(booking.createdAt).toLocaleString('az-AZ', { timeZone: 'Asia/Baku' })];
  });
  return '\uFEFF' + [headers, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}

// The server is the only booking store. No dormant local booking/calendar CRUD remains.
export const storageService = {
  exportToCSV(bookings: Booking[]): void {
    const blob = new Blob([createBookingsCsv(bookings)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Emgraphic_Studio_Bronlar_${getBakuTodayStr(new Date(getNowMs()))}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Let the browser begin the download before releasing its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
};