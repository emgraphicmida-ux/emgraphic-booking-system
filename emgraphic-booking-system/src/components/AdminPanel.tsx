import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CalendarDays, Check, Loader2, MessageCircle, Plus, RefreshCw, Search, Settings2, Trash2, X, XCircle } from 'lucide-react';
import { ALL_TIME_SLOTS, Booking, PHOTOSHOOT_CATEGORIES, PhotoshootType, isSameOrMatchingSlot } from '../types/booking';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { bookingEndsAt, isActiveBooking } from '../utils/attendance';
import { formatBakuDateAz, getBakuTodayStr } from '../utils/bakuTime';
import { buildWhatsAppLink } from '../utils/whatsappUtils';
import { MonthlyStatistics } from './MonthlyStatistics';
import { Modal } from './AdminModal';
import { StudioTools, type StudioBlock } from './StudioTools';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { useNow } from '../hooks/useNow';
import { getLastBookableDate } from '../utils/bookingWindow';
import officialLogo from '../assets/images/emgraphic-logo.jpg';

interface AdminPanelProps {
  bookings: Booking[];
  onRefresh: () => Promise<void>;
  onClose: () => void;
  adminKey: string;
  liveConnected: boolean;
  refreshedAt: Date | null;
}
type View = 'all' | 'today' | 'cancelled';
type Confirmation = { booking: Booking; action: 'cancelled' | 'delete' };
export const AdminPanel: React.FC<AdminPanelProps> = ({ bookings, onRefresh, adminKey, liveConnected, refreshedAt }) => {
  const [studioBlocks, setStudioBlocks] = useState<StudioBlock[]>([]);
  const [studioReady, setStudioReady] = useState(false);
  const reloadStudio = async () => {
    try {
      const response = await fetch('/api/admin/studio-blocks', { headers: { 'x-admin-key': adminKey } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error();
      setStudioBlocks(data.blocks); setStudioReady(true);
    } catch { setStudioReady(false); }
  };
  useLiveUpdates(reloadStudio);
  useEffect(() => { reloadStudio(); const timer = setInterval(reloadStudio, 15000); return () => clearInterval(timer); }, [adminKey]);
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const now = useNow();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manual, setManual] = useState({ clientName: '', clientPhone: '+994 ', photoshootType: PHOTOSHOOT_CATEGORIES[0].id, date: getBakuTodayStr(), timeSlot: '10:00', notes: '' });
  const [settings, setSettings] = useState({ whatsappNumber: '+994 77 607 97 07', studioAddress: 'Hövsan, MİDA 1, Bina 1' });
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const today = getBakuTodayStr(new Date(now));
  const visible = bookings.filter(b => {
    if (view === 'today' && b.date !== today) return false;
    if (view === 'cancelled' && b.status !== 'cancelled') return false;
    if (dateFilter && b.date !== dateFilter) return false;
    const search = query.trim().toLocaleLowerCase('az-AZ');
    return !search || [b.clientName, b.clientPhone, b.referenceCode, b.photoshootType].some(value => value.toLocaleLowerCase('az-AZ').includes(search));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));

  const run = async (operation: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Əməliyyatı yerinə yetirmək mümkün olmadı.'); }
    finally { mutation.current = false; setBusy(false); }
  };
  const changeStatus = async (booking: Booking, status: 'confirmed' | 'cancelled') => {
    await run(async () => {
      const result = await apiService.updateAdminBookingStatus(booking.id, status, adminKey, booking.status);
      if (!result.success) throw new Error(result.error || 'Status dəyişmədi.');
      await onRefresh();
      setConfirmation(null);
      setNotice(status === 'cancelled' ? 'Qeydiyyat ləğv edildi.' : 'Qeydiyyat bərpa edildi.');
    });
  };
  const ask = (booking: Booking, action: Confirmation['action']) => { setError(''); setConfirmation({ booking, action }); };
  const confirm = async () => {
    if (!confirmation) return;
    if (confirmation.action !== 'delete') return changeStatus(confirmation.booking, confirmation.action);
    await run(async () => {
      if (!await apiService.deleteAdminBooking(confirmation.booking.id, adminKey)) throw new Error('Qeydiyyatı silmək mümkün olmadı.');
      await onRefresh(); setConfirmation(null); setNotice('Qeydiyyat silindi.');
    });
  };
  const createManual = async (event: React.FormEvent) => {
    event.preventDefault(); setManualError('');
    await run(async () => {
      const result = await apiService.createAdminBooking(manual, adminKey);
      if (!result.success) { setManualError(result.error || 'Qeydiyyat yaradılmadı.'); return; }
      await onRefresh(); setManualOpen(false); setNotice('Yeni çəkiliş qeydiyyata alındı.');
      setManual(previous => ({ ...previous, clientName: '', clientPhone: '+994 ', notes: '' }));
    });
  };
  const openSettings = async () => {
    await run(async () => {
      const [contact, response] = await Promise.all([apiService.getSettingsStrict(), fetch('/api/settings/logo').then(async r => {
        if (!r.ok) throw new Error('Studiya məlumatlarını yükləmək mümkün olmadı. Yenidən yoxlayın.');
        const data = await r.json() as { logoUrl?: string | null };
        if (data.logoUrl !== null && typeof data.logoUrl !== 'string') throw new Error('Serverdən düzgün loqo məlumatı alınmadı.');
        return data;
      })]);
      setSettings({ whatsappNumber: contact.whatsappNumber, studioAddress: contact.studioAddress || '' });
      setLogo(response.logoUrl || null);
      setSettingsOpen(true);
    });
  };
  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(async () => {
      if (!await apiService.updateSettings(settings, adminKey)) throw new Error('Tənzimləmələr yadda saxlanılmadı.');
      setSettingsOpen(false); setNotice('Studiya məlumatları yeniləndi. Müştəri saytına da tətbiq edildi.');
    });
  };
  const saveLogo = async (file?: File) => {
    await run(async () => {
      let data = '';
      if (file) {
        if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error('PNG, JPG, WEBP və ya SVG seçin. Maksimum ölçü 8 MB-dır.');
        data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Şəkil oxunmadı.')); reader.readAsDataURL(file); });
      }
      if (!await apiService.updateLogo(data, adminKey)) throw new Error('Loqonu saxlamaq mümkün olmadı.');
      setLogo(data || null);
      window.dispatchEvent(new Event('emgraphic_logo_changed'));
      setNotice('Loqo bütün səhifələr üçün yeniləndi.');
    });
  };
  const badge = (b: Booking) => b.status === 'cancelled' ? <span className="inline-flex rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">{b.cancelledBy === 'client' ? 'Müştəri ləğv etdi' : 'Studiya ləğv etdi'}</span> : null;
  const actions = (b: Booking) => <div className="flex flex-wrap items-center gap-1.5">
    {b.status !== 'cancelled' && b.status !== 'no_show' && <button className="admin-button !text-slate-500" disabled={busy} onClick={() => ask(b, 'cancelled')} aria-label={b.referenceCode + ' ləğv et'} title="Qeydiyyatı ləğv et"><XCircle size={15}/></button>}
    {b.status === 'cancelled' && bookingEndsAt(b) > now && <button className="admin-button" disabled={busy} onClick={() => changeStatus(b, 'confirmed')}>Bərpa et</button>}
    <button className="admin-button !border-transparent !bg-transparent !px-2 !text-slate-400 hover:!text-rose-700" disabled={busy} onClick={() => ask(b, 'delete')} aria-label={b.referenceCode + ' sil'} title="Qeydiyyatı sil"><Trash2 size={15}/></button>
  </div>;

  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e76d23]">Emgraphic Studio / İdarəetmə</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Çəkilişlərə ümumi baxış</h1>
        <p className="mt-2 text-sm text-slate-500">{formatBakuDateAz(today)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="admin-button" onClick={() => storageService.exportToCSV(visible)}><ArrowDownToLine size={16}/>CSV ixrac et</button>
        <button className="admin-button" disabled={busy} aria-label="Studiya tənzimləmələri" onClick={openSettings}><Settings2 size={16}/></button>
        <button className="admin-button admin-button-primary" disabled={busy} onClick={() => { setError(''); setManualError(''); setManualOpen(true); }}><Plus size={16}/>Yeni qeydiyyat</button>
      </div>
    </section>

    {(error && !confirmation && !settingsOpen && !manualOpen) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span className="flex items-center gap-2"><Check size={17}/>{notice}</span><button aria-label="Bildirişi bağla" onClick={() => setNotice('')}><X size={16}/></button></div>}

    <StudioTools adminKey={adminKey} bookings={bookings} blocks={studioBlocks} ready={studioReady} onChanged={async () => { await Promise.all([reloadStudio(), onRefresh()]); }}/>

    <MonthlyStatistics bookings={bookings} now={now}/>

    <section className="rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <h2 className="text-base font-bold">Qeydiyyatlar <span className="ml-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{visible.length}</span></h2>
        <div className="flex items-center gap-3">
          <span className={'inline-flex items-center gap-1.5 text-[11px] font-semibold ' + (liveConnected ? 'text-emerald-600' : 'text-amber-700')}><span className={'h-1.5 w-1.5 rounded-full ' + (liveConnected ? 'bg-emerald-500' : 'bg-amber-500')}/>{liveConnected ? 'Canlı bağlantı' : 'Ehtiyat yenilənmə'}</span>
          <span className="hidden text-[11px] text-slate-400 sm:inline">{refreshedAt ? refreshedAt.toLocaleTimeString('az-AZ', { timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
          <button onClick={onRefresh} className="admin-button !min-h-8 !p-1.5" aria-label="Qeydiyyatları yenilə"><RefreshCw size={14}/></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 border-b border-slate-100 px-3 py-3 sm:flex sm:flex-wrap sm:px-4" aria-label="Qeydiyyat görünüşü">
        {([{ id: 'all', label: 'Bütün bronlar' }, { id: 'today', label: 'Bugün' }, { id: 'cancelled', label: 'Ləğv olunanlar' }] as const).map(tab => <button key={tab.id} aria-pressed={view === tab.id} onClick={() => { setView(tab.id); setDateFilter(''); }} className={'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ' + (view === tab.id ? 'bg-orange-50 text-[#d75a12]' : 'text-slate-500 hover:bg-slate-50')}>{tab.label}</button>)}
      </div>
      <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-[1fr_170px] sm:p-5">
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/><input aria-label="Qeydiyyat axtar" className="admin-input !pl-9" placeholder="Ad, nömrə və ya bron kodu..." value={query} onChange={e => setQuery(e.target.value)}/></div>
        <input aria-label="Tarixə görə filtr" type="date" className="admin-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)}/>
      </div>
      {visible.length === 0 ? <div className="px-6 py-16 text-center"><CalendarDays size={32} className="mx-auto mb-3 text-slate-300"/><h3 className="text-sm font-bold text-slate-700">Qeydiyyat tapılmadı</h3><p className="mt-1 text-xs text-slate-400">Yeni bronlar və dəyişikliklər burada avtomatik görünəcək.</p></div> : <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-400"><tr>{['Müştəri', 'Tarix və saat', 'Çəkiliş', 'Əməliyyatlar'].map(column => <th key={column} className="px-5 py-3 font-semibold">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{visible.map(b => <tr key={b.id} data-booking-id={b.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-5"><p className="font-bold text-slate-900">{b.clientName}</p><a className="mt-1 block text-[11px] text-slate-500" href={'tel:' + b.clientPhone}>{b.clientPhone}</a><span className="mt-1 block text-[10px] text-slate-400">{b.referenceCode}</span><div className="mt-1">{badge(b)}</div>{b.clientIp && <span className="mt-1 block break-all text-[10px] text-slate-400" title="Qeydiyyat sorğusunun IP ünvanı">IP: {b.clientIp}</span>}</td>
              <td className="whitespace-nowrap px-5 py-5"><p className="font-semibold">{b.date.split('-').reverse().join('.')}</p><p className="mt-1 text-slate-500">{b.timeSlot} <span className="text-[10px] text-slate-400">/ 30 dəq.</span></p></td>
              <td className="max-w-[200px] px-5 py-5"><p className="leading-relaxed text-slate-600">{b.photoshootType}</p>{b.notes && <p className="mt-1 text-[10px] text-slate-400" title={b.notes}>{b.notes.length > 55 ? b.notes.slice(0, 55) + '…' : b.notes}</p>}</td>
              <td className="max-w-[300px] px-5 py-5">{actions(b)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 lg:hidden">{visible.map(b => <article key={b.id} data-booking-id={b.id} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{b.clientName}</h3><p className="mt-1 text-[10px] text-slate-400">{b.referenceCode}</p></div>{badge(b)}</div>
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><CalendarDays size={14} className="text-slate-400"/>{b.date.split('-').reverse().join('.')}<span className="text-slate-300">/</span>{b.timeSlot}</p>
          <p className="mt-1.5 text-xs text-slate-500">{b.photoshootType}</p>
          {b.clientIp && <p className="mt-1 break-all text-[10px] text-slate-400">IP: {b.clientIp}</p>}
          <div className="my-3 flex items-center gap-3 text-xs"><a href={'tel:' + b.clientPhone} className="text-slate-500">{b.clientPhone}</a><a className="inline-flex items-center gap-1 text-emerald-600" target="_blank" rel="noreferrer" href={buildWhatsAppLink(b.clientPhone, 'Salam ' + b.clientName + '! Emgraphic Studio çəkilişinizlə bağlı əlaqə saxlayır.')}><MessageCircle size={13}/>WhatsApp</a></div>
          {b.notes && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">{b.notes}</p>}
          {actions(b)}
        </article>)}</div>
      </>}
      <div className="flex flex-wrap justify-between gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[10px] text-slate-400"><span>{visible.length} qeyd göstərilir</span><span>Bütün vaxtlar Bakı vaxtı ilədir</span></div>
    </section>


    {confirmation && <Modal title={confirmation.action === 'delete' ? 'Qeydiyyatı tamamilə silmək?' : 'Qeydiyyatı ləğv etmək?'} busy={busy} onClose={() => setConfirmation(null)}>
      <div className="mb-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold">{confirmation.booking.clientName}</p><p className="mt-1 text-xs text-slate-500">{confirmation.booking.date} / {confirmation.booking.timeSlot} / {confirmation.booking.referenceCode}</p></div>
      <p className="mb-5 text-sm leading-relaxed text-slate-500">{confirmation.action === 'delete' ? 'Bu qeyd həmişəlik silinəcək və aylıq statistikadan da çıxarılacaq. Qeydi saxlamaq üçün silmək əvəzinə ləğv edə bilərsiniz.' : 'Ləğvetmə studiya tərəfindən edilmiş kimi qeyd olunacaq və bu vaxt müştəri saytında boşalacaq.'}</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2"><button className="admin-button" disabled={busy} onClick={() => setConfirmation(null)}>Geri</button><button className="admin-button !border-rose-600 !bg-rose-600 !text-white" disabled={busy} onClick={confirm}>{busy && <Loader2 className="animate-spin" size={14}/>}Təsdiqlə</button></div>
    </Modal>}

    {manualOpen && <Modal title="Yeni qeydiyyat" busy={busy} onClose={() => setManualOpen(false)}>
      <form onSubmit={createManual}><fieldset disabled={busy} className="space-y-4">
        <div><label htmlFor="manual-name" className="admin-label">Müştərinin adı və soyadı</label><input id="manual-name" className="admin-input" required minLength={2} maxLength={70} value={manual.clientName} onChange={e => setManual({ ...manual, clientName: e.target.value })} placeholder="Ad və soyad"/></div>
        <div><label htmlFor="manual-phone" className="admin-label">Əlaqə nömrəsi</label><input id="manual-phone" type="tel" className="admin-input" required value={manual.clientPhone} onChange={e => setManual({ ...manual, clientPhone: e.target.value })}/></div>
        <div><label htmlFor="manual-type" className="admin-label">Çəkiliş növü</label><select id="manual-type" className="admin-input" value={manual.photoshootType} onChange={e => setManual({ ...manual, photoshootType: e.target.value as PhotoshootType })}>{PHOTOSHOOT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><label htmlFor="manual-date" className="admin-label">Tarix</label><input id="manual-date" type="date" required min={today} max={getLastBookableDate(now)} className="admin-input" value={manual.date} onChange={e => setManual({ ...manual, date: e.target.value })}/></div><div><label htmlFor="manual-slot" className="admin-label">Saat</label><select id="manual-slot" className="admin-input" value={manual.timeSlot} onChange={e => setManual({ ...manual, timeSlot: e.target.value })}>{ALL_TIME_SLOTS.map(slot => { const full = !studioReady || studioBlocks.some(b => !b.releasedAt && b.date === manual.date && b.timeSlots.includes(slot)) || bookings.some(b => isActiveBooking(b) && b.date === manual.date && isSameOrMatchingSlot(b.timeSlot, slot)); return <option key={slot} value={slot} disabled={full}>{slot}{full ? ' — Dolu' : ''}</option>; })}</select></div></div>
        <div><label htmlFor="manual-notes" className="admin-label">Əlavə qeyd</label><textarea id="manual-notes" rows={2} maxLength={500} className="admin-input" value={manual.notes} onChange={e => setManual({ ...manual, notes: e.target.value })}/></div>
        {(manualError || error) && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{manualError || error}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="admin-button" onClick={() => setManualOpen(false)}>Bağla</button><button className="admin-button admin-button-primary" type="submit">{busy && <Loader2 className="animate-spin" size={14}/>}Qeydiyyatı əlavə et</button></div>
      </fieldset></form>
    </Modal>}

    {settingsOpen && <Modal title="Studiya tənzimləmələri" busy={busy} onClose={() => setSettingsOpen(false)}>
      <form onSubmit={saveSettings}><fieldset disabled={busy} className="space-y-4">
        <div><label htmlFor="studio-phone" className="admin-label">WhatsApp nömrəsi</label><input id="studio-phone" className="admin-input" required value={settings.whatsappNumber} onChange={e => setSettings({ ...settings, whatsappNumber: e.target.value })}/></div>
        <div><label htmlFor="studio-address" className="admin-label">Studiya ünvanı</label><input id="studio-address" className="admin-input" required value={settings.studioAddress} onChange={e => setSettings({ ...settings, studioAddress: e.target.value })}/></div>
        <div><span className="admin-label">Studiya loqosu</span><div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3"><img src={logo || officialLogo} alt="Studiya loqosu" className="h-20 w-20 object-contain"/><div className="min-w-0 flex-1"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Yeni loqo seç" className="w-full text-xs" onChange={e => { const file = e.target.files?.[0]; if (file) saveLogo(file); e.target.value = ''; }}/>{logo && <button type="button" className="mt-2 text-xs font-semibold text-orange-600" onClick={() => saveLogo()}>Rəsmi loqoya qaytar</button>}</div></div></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        <p className="text-[11px] leading-relaxed text-slate-400">Dəyişikliklər müştəri saytına avtomatik tətbiq edilir.</p>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="admin-button" onClick={() => setSettingsOpen(false)}>Bağla</button><button type="submit" className="admin-button admin-button-primary">Yadda saxla</button></div>
      </fieldset></form>
    </Modal>}
  </div>;
};
