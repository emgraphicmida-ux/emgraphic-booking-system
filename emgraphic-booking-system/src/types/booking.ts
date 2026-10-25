export type PhotoshootType = 
  | '1 dekor (20-25 kadr fotoşəkil)'
  | '2 dekor (30-35 kadr fotoşəkil)'
  | '3 dekor (40-45 kadr fotoşəkil)'
  | '4 dekor (50-55 kadr fotoşəkil)'
  | '1 dekor + albom'
  | '2 dekor + albom'
  | '3 dekor + albom'
  | '4 dekor + albom'
  | '1 dekor + video'
  | '2 dekor + video'
  | '3 dekor + video'
  | '4 dekor + video'
  | 'Tək Video (fotosessiyasız)';

export interface PhotoshootCategory {
  id: PhotoshootType;
  title: string;
  duration: string;
  price: string;
  description: string;
  group: 'Standart Dekor' | 'Albomlu' | 'Videolu';
}

export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'completed' | 'no_show';

export interface Booking {
  id: string;
  referenceCode: string; // e.g. EM-4821
  clientSecret?: string; // Private key for this customer only
  clientName: string;
  clientPhone: string;
  photoshootType: PhotoshootType;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "14:00" or "14:30"
  notes?: string;
  hall?: string;
  status: BookingStatus;
  cancelledBy?: 'client' | 'admin' | null;
  completedAt?: string;
  checkedInAt?: string;
  noShowAt?: string;
  completionSource?: 'automatic' | 'admin';
  createdAt: string;
  notificationSent?: boolean;
  deviceId?: string;
  deviceFingerprint?: string;
  deviceTokenHash?: string;
  clientIp?: string;
}

export interface PublicSlotStatus {
  date: string;
  timeSlot: string;
}

export const ALL_TIME_SLOTS: string[] = [
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
];

export function normalizeTimeSlot(slot: string): string {
  if (!slot) return '';
  const s = String(slot).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }
  return s;
}

export function isSameOrMatchingSlot(slotA: string, slotB: string): boolean {
  if (!slotA || !slotB) return false;
  if (slotA === slotB) return true;
  return normalizeTimeSlot(slotA) === normalizeTimeSlot(slotB);
}

export const PHOTOSHOOT_CATEGORIES: PhotoshootCategory[] = [
  // Standart Dekor
  {
    id: '1 dekor (20-25 kadr fotoşəkil)',
    title: '1 dekor: 20 AZN (20-25 kadr fotoşəkil)',
    duration: '30 dəqiqə',
    price: '20 AZN',
    description: '1 dekorasiyada çəkiliş, 20-25 kadr fotoşəkil.',
    group: 'Standart Dekor',
  },
  {
    id: '2 dekor (30-35 kadr fotoşəkil)',
    title: '2 dekor: 30 AZN (30-35 kadr fotoşəkil)',
    duration: '30 dəqiqə',
    price: '30 AZN',
    description: '2 dekorasiyada çəkiliş, 30-35 kadr fotoşəkil.',
    group: 'Standart Dekor',
  },
  {
    id: '3 dekor (40-45 kadr fotoşəkil)',
    title: '3 dekor: 35 AZN (40-45 kadr fotoşəkil)',
    duration: '30 dəqiqə',
    price: '35 AZN',
    description: '3 dekorasiyada çəkiliş, 40-45 kadr fotoşəkil.',
    group: 'Standart Dekor',
  },
  {
    id: '4 dekor (50-55 kadr fotoşəkil)',
    title: '4 dekor: 45 AZN (50-55 kadr fotoşəkil)',
    duration: '30 dəqiqə',
    price: '45 AZN',
    description: '4 dekorasiyada çəkiliş, 50-55 kadr fotoşəkil.',
    group: 'Standart Dekor',
  },

  // Albomlu
  {
    id: '1 dekor + albom',
    title: '1 dekor + albom: 45 AZN',
    duration: '30 dəqiqə',
    price: '45 AZN',
    description: '1 dekor fotosessiyası və xüsusi dizaynlı fotoalbom.',
    group: 'Albomlu',
  },
  {
    id: '2 dekor + albom',
    title: '2 dekor + albom: 55 AZN',
    duration: '30 dəqiqə',
    price: '55 AZN',
    description: '2 dekor fotosessiyası və xüsusi dizaynlı fotoalbom.',
    group: 'Albomlu',
  },
  {
    id: '3 dekor + albom',
    title: '3 dekor + albom: 60 AZN',
    duration: '30 dəqiqə',
    price: '60 AZN',
    description: '3 dekor fotosessiyası və xüsusi dizaynlı fotoalbom.',
    group: 'Albomlu',
  },
  {
    id: '4 dekor + albom',
    title: '4 dekor + albom: 70 AZN',
    duration: '30 dəqiqə',
    price: '70 AZN',
    description: '4 dekor fotosessiyası və xüsusi dizaynlı fotoalbom.',
    group: 'Albomlu',
  },

  // Videolu
  {
    id: '1 dekor + video',
    title: '1 dekor + video: 40 AZN',
    duration: '30 dəqiqə',
    price: '40 AZN',
    description: '1 dekor fotosessiyası və estetik videoçarx / reels çəkilişi.',
    group: 'Videolu',
  },
  {
    id: '2 dekor + video',
    title: '2 dekor + video: 50 AZN',
    duration: '30 dəqiqə',
    price: '50 AZN',
    description: '2 dekor fotosessiyası və estetik videoçarx / reels çəkilişi.',
    group: 'Videolu',
  },
  {
    id: '3 dekor + video',
    title: '3 dekor + video: 65 AZN',
    duration: '30 dəqiqə',
    price: '65 AZN',
    description: '3 dekor fotosessiyası və estetik videoçarx / reels çəkilişi.',
    group: 'Videolu',
  },
  {
    id: '4 dekor + video',
    title: '4 dekor + video: 70 AZN',
    duration: '30 dəqiqə',
    price: '70 AZN',
    description: '4 dekor fotosessiyası və estetik videoçarx / reels çəkilişi.',
    group: 'Videolu',
  },
  {
    id: 'Tək Video (fotosessiyasız)',
    title: 'Tək Video (fotosessiyasız): 30 AZN-dən',
    duration: '30 dəqiqə',
    price: '30 AZN-dən',
    description: 'Fotosessiyasız, ayrıca videoçarx və ya reels çəkilişi.',
    group: 'Videolu',
  },
];
