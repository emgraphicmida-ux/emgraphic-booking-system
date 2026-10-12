import { Booking, ALL_TIME_SLOTS, isSameOrMatchingSlot } from '../types/booking';
import { INITIAL_BOOKINGS } from '../data/initialBookings';
import { getBakuTodayStr } from '../utils/bakuTime';

const STORAGE_KEY = 'emgraphic_studio_bookings_v1';

export const storageService = {
  getBookings(): Booking[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BOOKINGS));
        return INITIAL_BOOKINGS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_BOOKINGS;
    }
  },

  saveBookings(bookings: Booking[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    } catch (e) {
      console.error('Failed to save bookings to localStorage', e);
    }
  },

  resetToDefault(): Booking[] {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BOOKINGS));
      return INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  },

  getActiveBookings(): Booking[] {
    return this.getBookings().filter((b) => b.status === 'confirmed');
  },

  getBookingsForDate(dateStr: string): Booking[] {
    return this.getActiveBookings().filter((b) => b.date === dateStr);
  },

  getBookedSlotsForDate(dateStr: string): string[] {
    const dayBookings = this.getBookingsForDate(dateStr);
    return dayBookings.map((b) => b.timeSlot);
  },

  isDateFullyBooked(dateStr: string): boolean {
    const bookedSlots = this.getBookedSlotsForDate(dateStr);
    return ALL_TIME_SLOTS.every((slot) =>
      bookedSlots.some((b) => isSameOrMatchingSlot(b, slot))
    );
  },

  getAvailableSlotsCount(dateStr: string): number {
    const bookedSlots = this.getBookedSlotsForDate(dateStr);
    return ALL_TIME_SLOTS.filter(
      (slot) => !bookedSlots.some((b) => isSameOrMatchingSlot(b, slot))
    ).length;
  },

  createBooking(data: {
    clientName: string;
    clientPhone: string;
    photoshootType: Booking['photoshootType'];
    date: string;
    timeSlot: string;
    notes?: string;
  }): { success: boolean; booking?: Booking; error?: string } {
    const bookings = this.getBookings();

    // Check if slot is already taken by a confirmed booking
    const alreadyBooked = bookings.some(
      (b) => b.date === data.date && isSameOrMatchingSlot(b.timeSlot, data.timeSlot) && b.status === 'confirmed'
    );

    if (alreadyBooked) {
      return {
        success: false,
        error: 'Bu saat aralığı artıq başqa bir müştəri tərəfindən bron edilib. Zəhmət olmasa başqa saat seçin.',
      };
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newBooking: Booking = {
      id: `book-${Date.now()}-${randomSuffix}`,
      referenceCode: `EM-${randomSuffix}`,
      clientName: data.clientName.trim(),
      clientPhone: data.clientPhone.trim(),
      photoshootType: data.photoshootType,
      date: data.date,
      timeSlot: data.timeSlot,
      notes: data.notes?.trim() || '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      notificationSent: true,
    };

    const updated = [newBooking, ...bookings];
    this.saveBookings(updated);
    return { success: true, booking: newBooking };
  },

  cancelBooking(id: string): { success: boolean; booking?: Booking; error?: string } {
    const bookings = this.getBookings();
    let updatedBooking: Booking | undefined;

    const updated = bookings.map((b) => {
      if (b.id === id) {
        updatedBooking = { ...b, status: 'cancelled' as const };
        return updatedBooking;
      }
      return b;
    });

    if (updatedBooking) {
      this.saveBookings(updated);
      return { success: true, booking: updatedBooking };
    }
    return { success: false, error: 'Qeydiyyat tapılmadı və ya artıq ləğv edilib.' };
  },

  deleteBookingPermanently(id: string): boolean {
    const bookings = this.getBookings();
    const updated = bookings.filter((b) => b.id !== id);
    this.saveBookings(updated);
    return true;
  },

  exportToCSV(customBookings?: Booking[]): void {
    const bookings = customBookings && customBookings.length > 0 ? customBookings : this.getBookings();
    
    // Header for Google Sheets / Excel
    const headers = [
      'Referans Kodu',
      'Müştəri Adı və Soyadı',
      'Əlaqə Nömrəsi',
      'Çəkiliş Növü',
      'Tarix',
      'Saat Aralığı',
      'Status',
      'Ləğv Edən Tərəf',
      'Əlavə Qeydlər',
      'Müraciət Tarixi'
    ];

    const rows = bookings.map((b) => {
      let statusText = 'Gözləyir (Təsdiqlənib)';
      if (b.status === 'completed') statusText = 'Çəkiliş Tamamlandı (Oldu)';
      if (b.status === 'cancelled') statusText = 'Ləğv Edildi';

      let cancelledByText = '-';
      if (b.status === 'cancelled') {
        if (b.cancelledBy === 'client') cancelledByText = 'Müştəri ləğv etdi';
        else if (b.cancelledBy === 'admin') cancelledByText = 'Studiya ləğv etdi';
        else cancelledByText = 'Ləğv edilib';
      }

      return [
        `"${b.referenceCode}"`,
        `"${b.clientName.replace(/"/g, '""')}"`,
        `"${b.clientPhone}"`,
        `"${b.photoshootType}"`,
        `"${b.date}"`,
        `"${b.timeSlot}"`,
        `"${statusText}"`,
        `"${cancelledByText}"`,
        `"${(b.notes || '').replace(/"/g, '""')}"`,
        `"${new Date(b.createdAt).toLocaleString('az-AZ', { timeZone: 'Asia/Baku' })}"`
      ];
    });

    // Prepend UTF-8 BOM for Excel Azerbaijani/Turkish character support
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Emgraphic_Studio_Bronlar_${getBakuTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  generateICalendar(booking: Booking): void {
    let startH = '10';
    let startM = '00';
    let endH = '11';
    let endM = '00';

    if (booking.timeSlot && booking.timeSlot.includes(' - ')) {
      const [startHourStr, endHourStrWithSuffix] = booking.timeSlot.split(' - ');
      const [endHourStr] = endHourStrWithSuffix.split(' ');
      [startH, startM] = startHourStr.split(':');
      [endH, endM] = endHourStr.split(':');
    } else if (booking.timeSlot) {
      const match = booking.timeSlot.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        startH = match[1].padStart(2, '0');
        startM = match[2];
        const nextHour = (parseInt(startH, 10) + 1).toString().padStart(2, '0');
        endH = nextHour;
        endM = startM;
      }
    }

    const dateClean = booking.date.replace(/-/g, '');
    const dtStart = `${dateClean}T${startH}${startM}00`;
    const dtEnd = `${dateClean}T${endH}${endM}00`;

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Emgraphic Studio//Photoshoot Booking//AZ',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${booking.referenceCode}@emgraphicstudio.az`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Emgraphic Studio - ${booking.photoshootType} (${booking.clientName})`,
      `DESCRIPTION:Çəkiliş növü: ${booking.photoshootType}\\nKod: ${booking.referenceCode}\\nƏlaqə: ${booking.clientPhone}\\nÜnvan: Emgraphic Studio, Bakı`,
      'LOCATION:Emgraphic Studio, Nizami küçəsi 142, Bakı',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Emgraphic_Cekilis_${booking.referenceCode}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
