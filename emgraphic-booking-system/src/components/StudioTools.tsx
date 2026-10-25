import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, DatabaseBackup, Download, GraduationCap, Loader2, LockKeyhole, PencilLine, RotateCcw, Unlock } from 'lucide-react';
import { ALL_TIME_SLOTS, type Booking, isSameOrMatchingSlot } from '../types/booking';
import { isActiveBooking } from '../utils/attendance';
import { getBakuTodayStr } from '../utils/bakuTime';
import { STUDIO_END_TIMES, studioRangeSlots, formatStudioRanges } from '../utils/studioSchedule';
import { Modal } from './AdminModal';
import type { StudioBlock } from '../types/studio';
import { VinetkaGroupFields, emptyVinetkaGroup, vinetkaGroupPayload, type VinetkaGroupDraft } from './VinetkaGroupFields';
export type { StudioBlock } from '../types/studio';

interface Backup { id: string; createdAt: string; kind: string; bookingCount: number; blockCount: number }
const backupKinds: Record<string, string> = { daily: 'Gündəlik', manual: 'Əl ilə yaradılıb', before_delete: 'Silmədən əvvəl', before_restore: 'Bərpadan əvvəl' };

export function StudioTools({ adminKey, bookings, blocks, ready, onChanged }: {
  adminKey: string; bookings: Booking[]; blocks: StudioBlock[]; ready: boolean; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState<'schedule' | 'backups' | null>(null);
  const [date, setDate] = useState(getBakuTodayStr());
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('16:00');
  const selected = studioRangeSlots(startTime, endTime) || [];
  const [reason, setReason] = useState('Vinetka çəkilişi');
  const [includeGroup, setIncludeGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState<VinetkaGroupDraft>(emptyVinetkaGroup);
  const [editingGroup, setEditingGroup] = useState<StudioBlock | null>(null);
  const [editDraft, setEditDraft] = useState<VinetkaGroupDraft>(emptyVinetkaGroup);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [copies, setCopies] = useState<Backup[]>([]);
  const [copiesReady, setCopiesReady] = useState(false);
  const [restore, setRestore] = useState<Backup | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [release, setRelease] = useState<StudioBlock | null>(null);
  const headers = { 'Content-Type': 'application/json', 'x-admin-key': adminKey };
  const request = async (route: string, body?: object) => {
    const response = await fetch('/api/admin/' + route, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Əməliyyat baş tutmadı.');
    return data;
  };
  const loadCopies = async () => {
    try { const data = await request('backups'); setCopies(data.backups); setCopiesReady(true); }
    catch (err) { setCopiesReady(false); setError(err instanceof Error ? err.message : 'Nüsxələr yüklənmədi.'); }
  };
  useEffect(() => {
    if (open !== 'backups') return;
    loadCopies();
    const timer = setInterval(loadCopies, 30000);
    return () => clearInterval(timer);
  }, [open, adminKey]);
  const run = async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Serverlə əlaqə qurmaq mümkün olmadı.'); }
    finally { running.current = false; setBusy(false); }
  };
  const occupied = (slot: string) => blocks.some(b => !b.releasedAt && b.date === date && b.timeSlots.includes(slot)) || bookings.some(b => isActiveBooking(b) && b.date === date && isSameOrMatchingSlot(b.timeSlot, slot));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      await request('studio-blocks', { date, startTime, endTime, reason, ...(includeGroup ? { group: vinetkaGroupPayload(groupDraft) } : {}) });
      setGroupDraft(emptyVinetkaGroup()); setIncludeGroup(false);
      await onChanged(); setNotice(startTime + '–' + endTime + ' aralığı müştəri saytında dolu göstərilir.');
    });
  };
  const download = (copy: Backup) => run(async () => {
    const response = await fetch('/api/admin/backups/' + copy.id + '/download', { headers });
    if (!response.ok) throw new Error('Ehtiyat nüsxə yüklənmədi.');
    const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'emgraphic-' + copy.createdAt.slice(0, 10) + '-' + copy.id + '.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const editGroup = (block: StudioBlock) => {
    setError(''); setNotice(''); setRelease(null); setEditingGroup(block);
    setEditDraft(block.group ? { ...block.group, studentCount: String(block.group.studentCount) } : emptyVinetkaGroup());
  };
  const saveGroup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingGroup) return;
    run(async () => {
      await request('studio-blocks/group', { id: editingGroup.id, expectedVersion: editingGroup.updatedAt || editingGroup.createdAt, group: vinetkaGroupPayload(editDraft) });
      setEditingGroup(null); await onChanged(); setNotice('Vinetka qrupunun məlumatları yadda saxlanıldı.');
    });
  };
  const show = (which: 'schedule' | 'backups') => { setError(''); setNotice(''); setRelease(null); setRestore(null); setEditingGroup(null); setOpen(which); };
  const upcoming = [...new Set(blocks.filter(b => b.date >= getBakuTodayStr()).map(b => b.date))].sort();

  return <>
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Studiya planlaması və ehtiyat nüsxələr">
      <button className="flex items-center gap-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 text-left sm:p-5" onClick={() => show('schedule')}>
        <span className="rounded-xl bg-white p-3 text-orange-600"><CalendarClock size={23}/></span>
        <span><span className="block text-sm font-bold text-slate-900">Saatları dolu qeyd et</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">Vinetka qrupları və studiyanın çəkiliş cədvəli</span></span>
      </button>
      <button className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left sm:p-5" onClick={() => show('backups')}>
        <span className="rounded-xl bg-slate-50 p-3 text-slate-600"><DatabaseBackup size={23}/></span>
        <span><span className="block text-sm font-bold text-slate-900">Ehtiyat nüsxələr</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">Gündəlik avtomatik qoruma və yükləmə</span></span>
      </button>
    </section>
    {open && <Modal title={open === 'schedule' ? 'Studiyanın dolu saatları' : 'Ehtiyat nüsxələr'} busy={busy} onClose={() => setOpen(null)}>
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {open === 'schedule' ? <>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">Tarixi, başlanğıc və bitiş saatını seçin. Aralıqdakı bütün vaxtlar müştəri qeydiyyatı üçün bağlanacaq.</p>
        {!ready && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Saatları serverdən yoxlamaq mümkün olmadı. <button className="font-bold underline" onClick={() => onChanged()}>Yenidən yoxla</button></div>}
        <form onSubmit={save}><fieldset disabled={busy || !ready} className="space-y-4">
          <div><label htmlFor="block-date" className="admin-label">Çəkiliş tarixi</label><input id="block-date" type="date" required className="admin-input" value={date} onChange={e => { setDate(e.target.value); setRelease(null); setEditingGroup(null); }}/></div>
          {date && date < getBakuTodayStr() && <p className="text-xs text-slate-500">Keçmiş günün qrup məlumatlarına baxırsınız. Keçmiş tarixə yeni çəkiliş aralığı əlavə edilmir.</p>}
          <div><label htmlFor="block-reason" className="admin-label">Səbəb (yalnız admin görür)</label><input id="block-reason" required maxLength={150} className="admin-input" value={reason} onChange={e => setReason(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="block-start" className="admin-label">Başlanğıc saatı</label><select id="block-start" required className="admin-input" value={startTime} onChange={e => { const start = e.target.value; setStartTime(start); if (endTime <= start) setEndTime(STUDIO_END_TIMES[ALL_TIME_SLOTS.indexOf(start)]); }}>{ALL_TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></div>
            <div><label htmlFor="block-end" className="admin-label">Bitiş saatı</label><select id="block-end" required className="admin-input" value={endTime} onChange={e => setEndTime(e.target.value)}>{STUDIO_END_TIMES.map(slot => <option key={slot} value={slot} disabled={slot <= startTime}>{slot}</option>)}</select></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-600" checked={includeGroup} onChange={e => setIncludeGroup(e.target.checked)}/><span><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><GraduationCap size={17}/>Vinetka qrupunun məlumatlarını əlavə et</span><span className="mt-1 block text-[11px] leading-relaxed text-slate-500">Məktəb, sinif və əlaqə məlumatları yalnız adminə görünür.</span></span></label>
            {includeGroup && <div className="mt-4"><VinetkaGroupFields prefix="new-group" value={groupDraft} onChange={setGroupDraft}/></div>}
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-base font-bold text-orange-900">{startTime}–{endTime} · Vinetka / studiya məşğuldur</p>
            <p className="mt-2 text-xs leading-relaxed text-orange-800">Bu aralıqdakı bütün yarımsaatlıq vaxtlar dolu olacaq. {endTime === '20:30' ? 'Günün son 20:00–20:30 vaxtı da bağlanacaq.' : endTime + '-dan etibarən bron qəbul edilə bilər.'}</p>
            <div aria-label="Bağlanacaq vaxt aralıqları" className="mt-3 grid grid-cols-2 gap-2">{selected.map(slot => <span key={slot} className="rounded-lg bg-white/80 px-2 py-2 text-center text-xs font-semibold text-orange-900">{formatStudioRanges([slot])}</span>)}</div>
          </div>
          {selected.some(occupied) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Bu aralıqda artıq dolu vaxtlar var: {formatStudioRanges(selected.filter(occupied))}. Başqa aralıq seçin və ya mövcud bronları / bağlanmış saatları yoxlayın.</p>}
          <button type="submit" disabled={!date || date < getBakuTodayStr() || !selected.length || selected.some(occupied)} className="admin-button admin-button-primary w-full">{busy ? <Loader2 size={15} className="animate-spin"/> : <LockKeyhole size={15}/>}Aralığı dolu qeyd et</button>
        </fieldset></form>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-sm font-bold">Saatlar və vinetka qrupları</h3>
          {upcoming.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{upcoming.map(day => <button type="button" key={day} onClick={() => { setDate(day); setRelease(null); setEditingGroup(null); }} className={'rounded-lg px-2 py-2 text-xs ' + (date === day ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600')}>{day.split('-').reverse().join('.')}</button>)}</div>}
          {blocks.filter(b => b.date === date).length === 0 ? <p className="text-xs text-slate-400">Bu tarixdə admin tərəfindən bağlanmış saat yoxdur.</p> : blocks.filter(b => b.date === date).map(block => <div key={block.id} className="mb-2 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold">{block.reason}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{formatStudioRanges(block.timeSlots)}</p>
            {block.releasedAt && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Saatları açılıb · Qrup məlumatları saxlanılıb</p>}
            {block.group && <dl className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed">
              <div><dt className="text-slate-400">Məktəb / sinif</dt><dd className="break-words font-bold text-slate-800">{block.group.schoolName} · {block.group.className}</dd></div>
              <div><dt className="text-slate-400">Şagird sayı</dt><dd className="font-semibold text-slate-700">{block.group.studentCount}</dd></div>
              <div><dt className="text-slate-400">Məsul şəxs</dt><dd className="break-words text-slate-700">{block.group.contactName}</dd><dd><a className="inline-block py-1 font-semibold text-orange-700" href={'tel:' + block.group.contactPhone}>{block.group.contactPhone}</a></dd></div>
            </dl>}
            {editingGroup?.id === block.id ? <form onSubmit={saveGroup} className="mt-3 rounded-xl border border-orange-200 p-3"><fieldset disabled={busy} className="space-y-3">
              <p className="text-xs font-bold text-slate-800">Vinetka qrupunun məlumatları</p><VinetkaGroupFields prefix={'edit-group-' + block.id} value={editDraft} onChange={setEditDraft}/>
              <div className="flex flex-wrap gap-2"><button type="button" className="admin-button !text-xs" onClick={() => setEditingGroup(null)}>Geri</button><button type="submit" className="admin-button admin-button-primary !text-xs">{busy && <Loader2 size={14} className="animate-spin"/>}Qrup məlumatlarını saxla</button></div>
            </fieldset></form> : <button className="admin-button mt-2 !min-h-9 !text-xs" disabled={busy} onClick={() => editGroup(block)}><PencilLine size={13}/>{block.group ? 'Qrup məlumatlarını dəyiş' : 'Qrup məlumatlarını əlavə et'}</button>}
            {!block.releasedAt && (release?.id === block.id ? <div className="mt-3 space-y-2"><p className="text-xs text-amber-800">{formatStudioRanges(block.timeSlots)} aralığı yenidən müştərilərə açılacaq.{block.group && ' Qrup məlumatları saxlanılacaq.'}</p><div className="flex gap-2"><button className="admin-button" disabled={busy} onClick={() => setRelease(null)}>Geri</button><button className="admin-button admin-button-primary" disabled={busy} onClick={() => run(async () => { await request('studio-blocks/delete', { id: block.id }); setRelease(null); await onChanged(); setNotice('Saatlar müştəri qeydiyyatı üçün açıldı.'); })}>Saatları aç</button></div></div> : <button className="admin-button mt-2 !min-h-9 !text-xs" disabled={busy} onClick={() => { setError(''); setRelease(block); }}><Unlock size={13}/>Bu saatları aç</button>)}
          </div>)}
        </div>
      </> : <>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">Server işləyərkən hər gün Bakı vaxtı ilə avtomatik nüsxə yaradılır. Server sönülü qalsa, növbəti açılışda yaradılır. Nüsxələr bu kompüterdə saxlanır; ayrıca qorumaq üçün yükləyin. Müştəri məlumatları olduğu üçün faylı məxfi saxlayın.</p>
        <button className="admin-button admin-button-primary mb-5 w-full" disabled={busy} onClick={() => run(async () => { await request('backups', {}); await loadCopies(); setNotice('Yeni ehtiyat nüsxə yaradıldı.'); })}>{busy ? <Loader2 size={16} className="animate-spin"/> : <DatabaseBackup size={16}/>}İndi ehtiyat nüsxə yarat</button>
        {!copiesReady ? <p className="text-sm text-slate-500">Nüsxələr yoxlanılır… <button className="underline" onClick={loadCopies}>Yenilə</button></p> : <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">{copies.map(copy => <div key={copy.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold">{new Date(copy.createdAt).toLocaleString('az-AZ', { timeZone: 'Asia/Baku', dateStyle: 'short', timeStyle: 'short' })}</p><p className="mt-1 text-[11px] text-slate-500">{backupKinds[copy.kind] || copy.kind} · {copy.bookingCount} bron · {copy.blockCount} saat qrupu</p></div><button className="admin-button !min-h-9 !text-xs" disabled={busy} onClick={() => download(copy)}><Download size={13}/>Yüklə</button></div>
          {restore?.id === copy.id ? <div className="mt-3 space-y-3 rounded-lg bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-900">Bütün bronlar, bağlanmış saatlar, loqo və əlaqə məlumatları bu tarixə qaytarılacaq. Sonrakı dəyişikliklər əvəzlənəcək. Əvvəlcə indiki vəziyyətin ayrıca nüsxəsi avtomatik yaradılacaq.</p>
            <label className="block text-xs text-slate-700">Təsdiq üçün BƏRPA ET yazın<input aria-label="Bərpa təsdiqi" className="admin-input mt-2" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
            <div className="flex flex-wrap gap-2"><button className="admin-button" disabled={busy} onClick={() => setRestore(null)}>Geri</button><button className="admin-button !border-amber-600 !bg-amber-600 !text-white" disabled={busy || confirmation !== 'BƏRPA ET'} onClick={() => run(async () => { await request('backups/' + copy.id + '/restore', { confirmId: copy.id }); setRestore(null); setConfirmation(''); await Promise.all([loadCopies(), onChanged()]); setNotice('Ehtiyat nüsxə bərpa edildi. Müştəri saytı yeniləndi.'); })}>Nüsxəni bərpa et</button></div>
          </div> : <button className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[11px] font-semibold text-slate-500" disabled={busy} onClick={() => { setRestore(copy); setConfirmation(''); setError(''); }}><RotateCcw size={12}/>Bu nüsxədən bərpa et</button>}
        </div>)}</div>}
      </>}
    </Modal>}
  </>;
}
