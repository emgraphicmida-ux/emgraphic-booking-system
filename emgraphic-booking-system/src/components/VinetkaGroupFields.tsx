import React from 'react';
import type { VinetkaGroup } from '../types/studio';

export type VinetkaGroupDraft = Omit<VinetkaGroup, 'studentCount'> & { studentCount: string };
export const emptyVinetkaGroup = (): VinetkaGroupDraft => ({ schoolName: '', className: '', studentCount: '', contactName: '', contactPhone: '' });
export const vinetkaGroupPayload = (draft: VinetkaGroupDraft): VinetkaGroup => ({ ...draft, studentCount: Number(draft.studentCount) });

export function VinetkaGroupFields({ prefix, value, onChange }: { prefix: string; value: VinetkaGroupDraft; onChange: (value: VinetkaGroupDraft) => void }) {
  return <div className="space-y-3">
    <div><label htmlFor={prefix + '-school'} className="admin-label">Məktəbin adı</label><input id={prefix + '-school'} className="admin-input" required minLength={2} maxLength={150} placeholder="Məsələn, 10 nömrəli məktəb" value={value.schoolName} onChange={e => onChange({ ...value, schoolName: e.target.value })}/></div>
    <div className="grid grid-cols-2 gap-3">
      <div><label htmlFor={prefix + '-class'} className="admin-label">Sinif</label><input id={prefix + '-class'} className="admin-input" required maxLength={40} placeholder="Məsələn, 11 A" value={value.className} onChange={e => onChange({ ...value, className: e.target.value })}/></div>
      <div><label htmlFor={prefix + '-count'} className="admin-label">Şagird sayı</label><input id={prefix + '-count'} type="number" inputMode="numeric" min={1} max={2000} step={1} className="admin-input" required placeholder="Məsələn, 25" value={value.studentCount} onChange={e => onChange({ ...value, studentCount: e.target.value })}/></div>
    </div>
    <div><label htmlFor={prefix + '-contact'} className="admin-label">Məsul şəxsin adı</label><input id={prefix + '-contact'} className="admin-input" required minLength={2} maxLength={100} placeholder="Ad və soyad" value={value.contactName} onChange={e => onChange({ ...value, contactName: e.target.value })}/></div>
    <div><label htmlFor={prefix + '-phone'} className="admin-label">Məsul şəxsin əlaqə nömrəsi</label><input id={prefix + '-phone'} type="tel" className="admin-input" required maxLength={30} placeholder="+994 50 123 45 67" value={value.contactPhone} onChange={e => onChange({ ...value, contactPhone: e.target.value })}/></div>
  </div>;
}
