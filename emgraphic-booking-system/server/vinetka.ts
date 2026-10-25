import type { VinetkaGroup } from '../src/types/studio.js';
import { normalizePhone } from './identity.js';

export function parseVinetkaGroup(value: unknown): VinetkaGroup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Vinetka qrupunun məlumatlarını düzgün doldurun.');
  const fields = value as Record<string, unknown>;
  const text = (field: string, label: string, minimum: number, maximum: number) => {
    const raw = fields[field];
    if (typeof raw !== 'string') throw new Error(label + ' daxil edin.');
    const clean = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (clean.length < minimum || clean.length > maximum) throw new Error(label + ' ' + minimum + '–' + maximum + ' simvol olmalıdır.');
    return clean;
  };
  const schoolName = text('schoolName', 'Məktəbin adı', 2, 150);
  const className = text('className', 'Sinif', 1, 40);
  const contactName = text('contactName', 'Məsul şəxsin adı', 2, 100);
  const studentCount = fields.studentCount;
  if (typeof studentCount !== 'number' || !Number.isInteger(studentCount) || studentCount < 1 || studentCount > 2000) throw new Error('Şagird sayı 1–2000 arası tam ədəd olmalıdır.');
  const phone = typeof fields.contactPhone === 'string' ? normalizePhone(fields.contactPhone) : '';
  if (!phone) throw new Error('Məsul şəxsin düzgün Azərbaycan əlaqə nömrəsini daxil edin.');
  return { schoolName, className, studentCount, contactName, contactPhone: '+994' + phone };
}
