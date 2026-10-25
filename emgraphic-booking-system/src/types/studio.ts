export interface VinetkaGroup {
  schoolName: string;
  className: string;
  studentCount: number;
  contactName: string;
  contactPhone: string;
}

export interface StudioBlock {
  id: string;
  date: string;
  timeSlots: string[];
  reason: string;
  createdAt: string;
  updatedAt?: string;
  releasedAt?: string;
  group?: VinetkaGroup;
}
