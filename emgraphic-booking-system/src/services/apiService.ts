import { Booking, BookingStatus, PhotoshootType, PublicSlotStatus } from '../types/booking';
import { getDeviceId } from '../utils/deviceUtils';

const STORAGE_SECRETS_KEY = 'emgraphic_my_client_secrets';
const DEFAULT_SETTINGS = {
  whatsappNumber: '+994 77 607 97 07',
  studioAddress: 'Hövsan, MİDA 1, Bina 1',
  studioName: 'Emgraphic Studio',
};
let lastKnownSettings: { whatsappNumber: string; studioAddress?: string; studioName?: string } = { ...DEFAULT_SETTINGS };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface BookingInput {
  clientName: string;
  clientPhone: string;
  photoshootType: PhotoshootType;
  date: string;
  timeSlot: string;
  notes?: string;
}

export const apiService = {
  // Save private secret token for a booking created on this device
  saveSecret(bookingId: string, secretKey: string): void {
    try {
      const existing = this.getSecrets();
      existing[bookingId] = secretKey;
      localStorage.setItem(STORAGE_SECRETS_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error('Error saving secret:', e);
    }
  },

  getSecrets(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_SECRETS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  // 1. PUBLIC AVAILABILITY
  // Absolute privacy: returns ONLY { date, timeSlot } of booked slots.
  // Other customers cannot see who booked it or what phone was used!
  async getAvailability(): Promise<PublicSlotStatus[]> {
    try {
      const res = await fetch('/api/availability', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Mövcudluq məlumatı alına bilmədi');
      const data = await res.json();
      return data.bookedSlots || [];
    } catch (err) {
      throw err;
    }
  },

  async createAdminBooking(data: BookingInput, adminKey: string): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      return res.ok && result.success
        ? { success: true, booking: result.booking }
        : { success: false, error: result.error || 'Qeydiyyatı əlavə etmək mümkün olmadı.' };
    } catch {
      return { success: false, error: 'Serverlə əlaqə qurulmadı. Yenidən cəhd edin.' };
    }
  },

  // 2. CHECK IF CURRENT DEVICE ALREADY HAS AN ACTIVE BOOKING
  async checkMyActiveBooking(): Promise<{ hasActiveBooking: boolean; activeBooking: Booking | null }> {
    try {
      const deviceId = getDeviceId();
      const secrets = this.getSecrets();
      const tokens = Object.values(secrets);

      const res = await fetch('/api/my-active-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          deviceId,
          tokens,
        }),
      });

      if (!res.ok) throw new Error('Aktiv qeydiyyatı yoxlamaq mümkün olmadı.');
      const data = await res.json();
      return {
        hasActiveBooking: !!data.hasActiveBooking,
        activeBooking: data.activeBooking || null,
      };
    } catch (err) {
      console.error('Error checking active booking:', err);
      throw err;
    }
  },

  // 3. CREATE BOOKING
  async createBooking(data: {
    clientName: string;
    clientPhone: string;
    photoshootType: PhotoshootType;
    date: string;
    timeSlot: string;
    notes?: string;
  }): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      const deviceId = getDeviceId();

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          ...data,
          deviceId,
          tokens: Object.values(this.getSecrets()),
        }),
      });
      const result = await res.json();

      if (res.ok && result.success && result.booking) {
        if (result.booking.clientSecret) {
          this.saveSecret(result.booking.id, result.booking.clientSecret);
        }
        return { success: true, booking: result.booking };
      }

      return {
        success: false,
        error: result.error || 'Qeydiyyat zamanı xəta baş verdi.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Serverlə əlaqə qurularkən xəta baş verdi.',
      };
    }
  },

  // 4. GET ONLY CURRENT CUSTOMER'S BOOKINGS
  // Strictly fetches bookings belonging to this customer
  async getMyBookings(phoneQuery?: string): Promise<Booking[]> {
    try {
      const deviceId = getDeviceId();
      const secrets = this.getSecrets();
      const tokens = Object.values(secrets);

      const res = await fetch('/api/my-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({
          deviceId,
          tokens,
          phone: phoneQuery,
        }),
      });

      if (!res.ok) throw new Error('Sifarişlər alına bilmədi');
      const data = await res.json();
      if (!Array.isArray(data.bookings)) throw new Error('Serverdən düzgün qeydiyyat məlumatı alınmadı.');
      return data.bookings;
    } catch (err) {
      console.error('Error fetching my bookings:', err);
      throw err;
    }
  },

  // 5. CANCEL BOOKING
  // Reliable cancellation on the backend; frees the slot immediately.
  // The server checks its signed owner cookie or the stored booking secret.
  async cancelBooking(
    bookingId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const secrets = this.getSecrets();
      const clientSecret = secrets[bookingId];

      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          clientSecret,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || 'Qeydiyyatınız uğurla ləğv edildi və saat dərhal boşaldıldı.',
        };
      }

      return {
        success: false,
        error: data.error || 'Qeydiyyat ləğv edilərkən xəta baş verdi.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Server xətası baş verdi. Zəhmət olmasa təkrar cəhd edin.',
      };
    }
  },

  // 6. STUDIO SETTINGS (WhatsApp & Contact)
  async getSettingsStrict(): Promise<{ whatsappNumber: string; studioAddress?: string; studioName?: string }> {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    if (!res.ok) throw new ApiError('Studiya məlumatları yüklənmədi. Yenidən cəhd edin.', res.status);
    const data = await res.json();
    const settings = data.settings;
    if (!settings || typeof settings.whatsappNumber !== 'string' || !settings.whatsappNumber.trim() ||
        (settings.studioAddress !== undefined && typeof settings.studioAddress !== 'string') ||
        (settings.studioName !== undefined && typeof settings.studioName !== 'string')) {
      throw new ApiError('Serverdən düzgün studiya məlumatı alınmadı.', 502);
    }
    lastKnownSettings = {
      whatsappNumber: settings.whatsappNumber,
      studioAddress: settings.studioAddress,
      studioName: settings.studioName,
    };
    return { ...lastKnownSettings };
  },

  // Public pages may keep the last successfully loaded contacts while offline.
  // Admin editing uses getSettingsStrict so fallback data can never overwrite settings.
  async getSettings(): Promise<{ whatsappNumber: string; studioAddress?: string; studioName?: string }> {
    try {
      return await this.getSettingsStrict();
    } catch {
      return { ...lastKnownSettings };
    }
  },

  async updateSettings(
    settings: {
      whatsappNumber?: string;
      studioAddress?: string;
      studioName?: string;
    },
    adminKey: string
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async updateLogo(logoUrl: string, adminKey: string): Promise<boolean> {
    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ logoUrl }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 7. ADMIN ENDPOINTS
  async getAdminBookings(adminKey: string): Promise<Booking[]> {
    try {
      const res = await fetch('/api/admin/bookings', {
        cache: 'no-store',
        headers: {
          'x-admin-key': adminKey,
          'Cache-Control': 'no-cache',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(data.error || 'Qeydiyyatları yükləmək mümkün olmadı.', res.status);
      if (!Array.isArray(data.bookings)) throw new ApiError('Serverdən düzgün məlumat alınmadı.', 500);
      return data.bookings || [];
    } catch (err) {
      console.error('getAdminBookings error:', err);
      throw err;
    }
  },

  async updateAdminBookingStatus(
    bookingId: string,
    status: BookingStatus,
    adminKey: string,
    expectedStatus?: BookingStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/admin/bookings/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ bookingId, status, expectedStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Status yenilənmədi' };
    } catch {
      return { success: false, error: 'Server xətası' };
    }
  },

  async deleteAdminBooking(bookingId: string, adminKey: string): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/bookings/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ bookingId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
