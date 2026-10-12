import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Trash2,
  XCircle,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Phone,
  MessageCircle,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Plus,
  ExternalLink,
  Camera,
  CheckCheck,
  CalendarDays,
  Filter,
  MapPin,
} from 'lucide-react';
import { Booking, ALL_TIME_SLOTS, PHOTOSHOOT_CATEGORIES, PhotoshootType } from '../types/booking';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { getBakuTodayStr } from '../utils/bakuTime';
import { EmgraphicEmblemSvg } from './EmgraphicEmblemSvg';

interface AdminPanelProps {
  bookings: Booking[];
  onRefresh: () => void;
  onClose: () => void;
  adminKey: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ bookings, onRefresh, onClose, adminKey }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled_client' | 'cancelled_admin' | 'cancelled'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(null);

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [studioWhatsApp, setStudioWhatsApp] = useState('+994 77 607 97 07');
  const [studioAddress, setStudioAddress] = useState('Hövsan, MİDA 1, Bina 1');
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  const [adminLogoPreview, setAdminLogoPreview] = useState<string | null>(() => {
    try {
      return localStorage.getItem('emgraphic_studio_official_logo') || null;
    } catch {
      return null;
    }
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch official studio settings & logo
  React.useEffect(() => {
    let isMounted = true;
    apiService.getSettings().then((s) => {
      if (isMounted) {
        if (s?.whatsappNumber) setStudioWhatsApp(s.whatsappNumber);
        if (s?.studioAddress) setStudioAddress(s.studioAddress);
      }
    });

    fetch('/api/settings/logo')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.logoUrl) {
          setAdminLogoPreview(data.logoUrl);
          try {
            localStorage.setItem('emgraphic_studio_official_logo', data.logoUrl);
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Zəhmət olmasa şəkil faylı seçin (PNG, JPG, SVG)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('Fayl ölçüsü maksimum 8 MB ola bilər');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setAdminLogoPreview(dataUrl);
      try {
        localStorage.setItem('emgraphic_studio_official_logo', dataUrl);
      } catch {}
      window.dispatchEvent(new Event('emgraphic_logo_changed'));

      const ok = await apiService.updateLogo(dataUrl, adminKey);
      setIsUploadingLogo(false);
      if (ok) {
        setActionNotice('Studiya loqosu uğurla yeniləndi!');
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        setActionNotice('Loqo yadda saxlanılarkən xəta baş verdi');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogoToOfficial = async () => {
    setIsUploadingLogo(true);
    setAdminLogoPreview(null);
    try {
      localStorage.removeItem('emgraphic_studio_official_logo');
    } catch {}
    window.dispatchEvent(new Event('emgraphic_logo_changed'));

    await apiService.updateLogo('', adminKey);
    setIsUploadingLogo(false);
    setActionNotice('Rəsmi Emgraphic Studio vektor loqosuna qaytarıldı!');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWhatsApp(true);
    const success = await apiService.updateSettings(
      {
        whatsappNumber: studioWhatsApp.trim(),
        studioAddress: studioAddress.trim(),
      },
      adminKey
    );
    setIsSavingWhatsApp(false);
    if (success) {
      setActionNotice(`Studiya tənzimləmələri uğurla yadda saxlanıldı!`);
      setShowWhatsAppModal(false);
    } else {
      setActionNotice('Tənzimləmələri saxlamaq mümkün olmadı (icazə verilmədi).');
    }
  };

  // Manual booking form state
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('+994 ');
  const [manualType, setManualType] = useState<PhotoshootType>('1 dekor (20-25 kadr fotoşəkil)');
  const [manualDate, setManualDate] = useState(() => getBakuTodayStr());
  const [manualSlot, setManualSlot] = useState(ALL_TIME_SLOTS[0]);
  const [manualNotes, setManualNotes] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Months available in bookings
  const currentMonthStr = getBakuTodayStr().slice(0, 7); // e.g. "2026-10"
  const allMonths = Array.from(
    new Set(
      (bookings || [])
        .map((b) => (b?.date ? b.date.slice(0, 7) : ''))
        .filter(Boolean)
    )
  ).sort().reverse();
  if (!allMonths.includes(currentMonthStr)) {
    allMonths.unshift(currentMonthStr);
  }

  // Monthly stats calculations (for target month or overall)
  const targetMonth = monthFilter === 'all' ? currentMonthStr : monthFilter;
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const targetMonthBookings = safeBookings.filter((b) => (b?.date || '').startsWith(targetMonth));
  const monthCompletedCount = targetMonthBookings.filter((b) => b?.status === 'completed').length;
  const monthConfirmedCount = targetMonthBookings.filter((b) => b?.status === 'confirmed').length;
  const monthCancelledClientCount = targetMonthBookings.filter((b) => b?.status === 'cancelled' && b?.cancelledBy === 'client').length;
  const monthCancelledAdminCount = targetMonthBookings.filter((b) => b?.status === 'cancelled' && b?.cancelledBy === 'admin').length;
  const monthCancelledTotal = targetMonthBookings.filter((b) => b?.status === 'cancelled').length;

  // Filter bookings
  const filteredBookings = safeBookings.filter((b) => {
    if (!b) return false;
    const name = (b.clientName || '').toLowerCase();
    const phone = b.clientPhone || '';
    const ref = (b.referenceCode || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch =
      name.includes(query) ||
      phone.includes(searchTerm) ||
      ref.includes(query);

    let matchesStatus = true;
    if (statusFilter === 'confirmed') matchesStatus = b.status === 'confirmed';
    else if (statusFilter === 'completed') matchesStatus = b.status === 'completed';
    else if (statusFilter === 'cancelled_client') matchesStatus = b.status === 'cancelled' && b.cancelledBy === 'client';
    else if (statusFilter === 'cancelled_admin') matchesStatus = b.status === 'cancelled' && b.cancelledBy === 'admin';
    else if (statusFilter === 'cancelled') matchesStatus = b.status === 'cancelled';

    const matchesType = typeFilter === 'all' ? true : b.photoshootType === typeFilter;
    const matchesDate = !dateFilter ? true : b.date === dateFilter;
    const matchesMonth = monthFilter === 'all' ? true : (b.date || '').startsWith(monthFilter);

    return matchesSearch && matchesStatus && matchesType && matchesDate && matchesMonth;
  });

  const totalBookings = safeBookings.length;
  const totalCompletedOverall = safeBookings.filter((b) => b?.status === 'completed').length;

  // Actions
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    storageService.cancelBooking(cancellingBooking.id);
    await apiService.updateAdminBookingStatus(cancellingBooking.id, 'cancelled', adminKey);
    setActionNotice(
      `"${cancellingBooking.referenceCode}" nömrəli çəkiliş STUDİYA TƏRƏFİNDƏN ləğv edildi və saat (${cancellingBooking.date} / ${cancellingBooking.timeSlot}) dərhal boşaldıldı.`
    );
    onRefresh();
    setCancellingBooking(null);
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleConfirmComplete = async () => {
    if (!completingBooking) return;
    await apiService.updateAdminBookingStatus(completingBooking.id, 'completed', adminKey);
    setActionNotice(
      `🎉 "${completingBooking.clientName}" üçün çəkiliş uğurla təsdiqləndi (Müştəri gəldi və çəkiliş tamamlandı)!`
    );
    onRefresh();
    setCompletingBooking(null);
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleRevertToConfirmed = async (b: Booking) => {
    const res = await apiService.updateAdminBookingStatus(b.id, 'confirmed', adminKey);
    if (res.success) {
      setActionNotice(`"${b.clientName}" yenidən təsdiqlənmiş statusuna qaytarıldı.`);
      onRefresh();
    } else {
      setActionNotice(res.error || 'Bu saat üçün artıq başqa təsdiqlənmiş aktiv bron var!');
    }
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBooking) return;
    storageService.deleteBookingPermanently(deletingBooking.id);
    await apiService.deleteAdminBooking(deletingBooking.id, adminKey);
    setActionNotice(`Qeyd bazadan silindi.`);
    onRefresh();
    setDeletingBooking(null);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleExportCSV = () => {
    storageService.exportToCSV(bookings);
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    if (!manualName.trim()) {
      setManualError('Müştəri adını daxil edin.');
      return;
    }
    await apiService.createBooking({
      clientName: manualName,
      clientPhone: manualPhone,
      photoshootType: manualType,
      date: manualDate,
      timeSlot: manualSlot,
      notes: manualNotes,
    });

    setActionNotice(`Yeni çəkiliş uğurla qeydiyyata alındı.`);
    onRefresh();
    setShowManualModal(false);
    setManualName('');
    setManualNotes('');
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Helper format month name
  const formatMonthName = (mStr: string) => {
    const [y, m] = mStr.split('-');
    const mNum = parseInt(m, 10);
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
      'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
    ];
    return `${months[mNum - 1] || mStr} ${y}`;
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Admin Panel Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                İnzibatçı Paneli (Admin)
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Canlı Avto-Sinxron (3 san)
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Çəkilişlərin təsdiqi, tamamlanması, ləğvetmə mənbəyi və aylıq statistika idarəetməsi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Məlumatları dərhal yenilə"
            >
              <RefreshCw className="h-4 w-4 text-slate-500" />
              <span>Yenilə</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Manual Bron Əlavə Et</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="Google Sheets və Excel üçün UTF-8 CSV faylını yüklə"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Google Sheets / CSV Yüklə</span>
            </button>

            <a
              href="https://maps.app.goo.gl/uKw9CnAKpEGXVrGm8"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#F37021] hover:border-[#F37021] transition-colors shadow-2xs cursor-pointer"
              title="Ünvanı Google Xəritədə açın"
            >
              <MapPin className="h-4 w-4 text-[#F37021]" />
              <span className="hidden sm:inline">Hövsan, MİDA 1 ↗</span>
              <span className="sm:hidden">Xəritə ↗</span>
            </a>

            <button
              onClick={() => setShowWhatsAppModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2 text-xs sm:text-sm font-semibold text-[#F37021] hover:bg-orange-100 transition-colors shadow-2xs cursor-pointer"
              title="Studiya WhatsApp nömrəsini dəyiş"
            >
              <MessageCircle className="h-4 w-4 text-[#F37021]" />
              <span className="hidden sm:inline">WhatsApp:</span>
              <span className="font-mono-num font-bold text-slate-900">{studioWhatsApp}</span>
            </button>
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
              <span className="font-semibold">{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* MONTHLY KPI & STATISTICS CARDS (Tələb olunan: "ayda ne qeder cekilis edirikse sayi goruncun") */}
        <div className="mt-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#F37021]" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Aylıq Çəkiliş Statistikası: <span className="text-[#F37021]">{formatMonthName(targetMonth)}</span>
              </h3>
            </div>

            {/* Month Filter Selector */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 font-medium">Ayı seçin:</span>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-slate-800 focus:outline-none shadow-2xs"
              >
                <option value="all">Bütün Aylar (Cari: {formatMonthName(currentMonthStr)})</option>
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. COMPLETED PHOTOSHOOTS THIS MONTH */}
            <div className="rounded-xl border-2 border-emerald-400 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-700">Tamamlanan Çəkilişlər</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs">
                  <Camera className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-2 font-mono-num text-3xl sm:text-4xl font-extrabold text-emerald-700">
                {monthCompletedCount} <span className="text-xs sm:text-sm font-bold text-slate-500">çəkiliş</span>
              </p>
              <p className="mt-1.5 text-xs text-emerald-800 font-semibold flex items-center gap-1">
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Müştəri gəlib və çəkiliş olub</span>
              </p>
            </div>

            {/* 2. TOTAL BOOKINGS IN MONTH */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-700">Aylıq Ümumi Sifariş</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Calendar className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-2 font-mono-num text-3xl sm:text-4xl font-extrabold text-slate-900">
                {targetMonthBookings.length} <span className="text-xs sm:text-sm font-semibold text-slate-400">sifariş</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500 font-medium">
                Bu ay üçün qeydiyyat sayı
              </p>
            </div>

            {/* 3. PENDING CONFIRMED (Awaiting shoot) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-700">Gözləyən (Aktiv)</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Clock className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-2 font-mono-num text-3xl sm:text-4xl font-extrabold text-sky-700">
                {monthConfirmedCount} <span className="text-xs sm:text-sm font-semibold text-slate-400">aktiv</span>
              </p>
              <p className="mt-1.5 text-xs text-sky-800 font-medium">
                Çəkiliş vaxtı gözlənilir
              </p>
            </div>

            {/* 4. CANCELLATIONS BREAKDOWN (Client vs Admin) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-700">Ləğv Olunanlar</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700">
                  <XCircle className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-2 font-mono-num text-3xl sm:text-4xl font-extrabold text-red-600">
                {monthCancelledTotal} <span className="text-xs sm:text-sm font-semibold text-slate-400">ləğv</span>
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="text-rose-700">Müştəri: {monthCancelledClientCount}</span>
                <span>•</span>
                <span className="text-amber-800">Studiya: {monthCancelledAdminCount}</span>
              </div>
            </div>
          </div>

          {/* Monthly comparison overview strip across all months */}
          {allMonths.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-200/90">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 mb-2.5">
                <Calendar className="h-4 w-4 text-[#F37021]" />
                <span>Aylar üzrə çəkiliş icmalı:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {allMonths.map((m) => {
                  const mBookings = bookings.filter((b) => b.date.startsWith(m));
                  const mCompleted = mBookings.filter((b) => b.status === 'completed').length;
                  const mConfirmed = mBookings.filter((b) => b.status === 'confirmed').length;
                  const mCancelled = mBookings.filter((b) => b.status === 'cancelled').length;
                  const isCur = m === targetMonth;

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonthFilter(m)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isCur
                          ? 'bg-orange-50/80 border-[#F37021] shadow-2xs ring-1 ring-[#F37021]/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-slate-900">
                        <span>{formatMonthName(m)}</span>
                        <span className="font-mono-num text-xs text-slate-500 font-semibold">{mBookings.length} sifariş</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5 text-xs font-semibold">
                        <span className="text-emerald-700 font-bold">✔ {mCompleted} tamam</span>
                        <span className="text-sky-700">⏳ {mConfirmed}</span>
                        {mCancelled > 0 && <span className="text-red-600">✕ {mCancelled}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ad, nömrə və ya kod..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-slate-800 focus:outline-none"
            />
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-slate-900 focus:border-slate-800 focus:outline-none"
            >
              <option value="all">Bütün Statuslar</option>
              <option value="confirmed">⏳ Gözləyir (Təsdiqlənmiş)</option>
              <option value="completed">✔ Çəkiliş Oldu (Tamamlandı)</option>
              <option value="cancelled_client">🔴 Müştəri Ləğv Etdi</option>
              <option value="cancelled_admin">🟠 Studiya Ləğv Etdi</option>
              <option value="cancelled">Bütün Ləğvlər</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-slate-900 focus:border-slate-800 focus:outline-none"
            >
              <option value="all">Bütün Çəkiliş Növləri</option>
              {PHOTOSHOOT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm font-semibold text-slate-900 focus:border-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter || monthFilter !== 'all') && (
          <div className="mt-3.5 flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span>Tapılan qeydlər: <strong className="text-slate-900">{filteredBookings.length}</strong></span>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
                setDateFilter('');
                setMonthFilter('all');
              }}
              className="text-[#F37021] font-bold hover:underline cursor-pointer"
            >
              Süzgəcləri təmizlə
            </button>
          </div>
        )}
      </div>

      {/* Bookings View: Mobile Cards & Desktop Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* MOBILE CARD VIEW (< md screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredBookings.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400 text-sm sm:text-base">
              Heç bir qeydiyyat tapılmadı.
            </div>
          ) : (
            filteredBookings.map((b) => {
              const isConfirmed = b.status === 'confirmed';
              const isCompleted = b.status === 'completed';
              const isCancelled = b.status === 'cancelled';

              const cleanPhone = b.clientPhone.replace(/[^\d+]/g, '');
              const waUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(
                `Salam ${b.clientName}! Emgraphic Studio-dakı çəkilişinizlə bağlı əlaqə saxlayırıq.`
              )}`;

              return (
                <div
                  key={b.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-50/25 border-l-4 border-l-emerald-500'
                      : isCancelled
                      ? 'bg-slate-50/60 opacity-75 border-l-4 border-l-rose-400'
                      : 'bg-white border-l-4 border-l-sky-500'
                  }`}
                >
                  {/* Top Bar: Code, Date & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono-num font-extrabold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                        {b.referenceCode}
                      </span>
                      <p className="mt-1 font-mono-num font-bold text-sm text-slate-800">
                        {b.date} • {b.timeSlot}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          <CheckCheck className="h-3.5 w-3.5 text-emerald-700" />
                          Çəkiliş Oldu
                        </span>
                      )}
                      {isConfirmed && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs font-bold text-sky-800">
                          <span className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
                          Gözləyir
                        </span>
                      )}
                      {isCancelled && (
                        b.cancelledBy === 'client' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-300 px-2.5 py-1 text-xs font-bold text-rose-800">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            Müştəri Ləğv Etdi
                          </span>
                        ) : b.cancelledBy === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-300 px-2.5 py-1 text-xs font-bold text-amber-800">
                            <XCircle className="h-3.5 w-3.5 text-amber-600" />
                            Studiya Ləğv Etdi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700">
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                            Ləğv Edilib
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">{b.clientName}</span>
                      <div className="flex items-center gap-1">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-xs font-bold shadow-2xs hover:bg-emerald-700"
                          title="WhatsApp ilə yaz"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`tel:${cleanPhone}`}
                          className="rounded-lg p-1 text-slate-600 bg-slate-200/70 hover:bg-slate-300"
                          title="Zəng et"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    <p className="font-mono-num font-medium text-xs text-slate-700">{b.clientPhone}</p>
                    <p className="text-xs font-semibold text-[#F37021]">{b.photoshootType}</p>
                    {b.notes && (
                      <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-200/60">
                        Qeyd: {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-1">
                      {isConfirmed && (
                        <button
                          type="button"
                          onClick={() => setCompletingBooking(b)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Çəkiliş Oldu</span>
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleRevertToConfirmed(b)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          Gözləyirə Qaytar
                        </button>
                      )}

                      {isConfirmed && (
                        <button
                          type="button"
                          onClick={() => setCancellingBooking(b)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-all shadow-2xs cursor-pointer"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span>Ləğv Et</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeletingBooking(b)}
                      className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Bazadan sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (md+ screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm sm:text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm">
              <tr>
                <th className="py-4 px-4">Kod</th>
                <th className="py-4 px-4">Müştəri Adı</th>
                <th className="py-4 px-4">Əlaqə Nömrəsi</th>
                <th className="py-4 px-4">Çəkiliş Növü</th>
                <th className="py-4 px-4">Tarix</th>
                <th className="py-4 px-4">Saat Aralığı</th>
                <th className="py-4 px-4">Status & Mənbə</th>
                <th className="py-4 px-4 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-base">
                    Heç bir qeydiyyat tapılmadı.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const isConfirmed = b.status === 'confirmed';
                  const isCompleted = b.status === 'completed';
                  const isCancelled = b.status === 'cancelled';

                  const cleanPhone = b.clientPhone.replace(/[^\d+]/g, '');
                  const waUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(
                    `Salam ${b.clientName}! Emgraphic Studio-dakı çəkilişinizlə bağlı əlaqə saxlayırıq.`
                  )}`;

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-50/25'
                          : isCancelled
                          ? 'opacity-70 bg-slate-50/50'
                          : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="py-4 px-4 font-mono-num font-extrabold text-slate-900 whitespace-nowrap text-sm">
                        {b.referenceCode}
                      </td>

                      {/* Name */}
                      <td className="py-4 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div>
                          <span className="text-sm sm:text-base font-bold">{b.clientName}</span>
                          {b.notes && (
                            <p className="text-xs text-slate-500 font-normal italic truncate max-w-[220px]">
                              {b.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num font-semibold text-slate-800 text-sm">{b.clientPhone}</span>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="WhatsApp ilə yaz"
                          >
                            <MessageCircle className="h-4.5 w-4.5" />
                          </a>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                            title="Zəng et"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-800">
                          {b.photoshootType}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 font-mono-num whitespace-nowrap font-semibold text-slate-800 text-sm">
                        {b.date}
                      </td>

                      {/* Time slot */}
                      <td className="py-4 px-4 font-mono-num font-extrabold text-slate-900 whitespace-nowrap text-sm sm:text-base">
                        {b.timeSlot}
                      </td>

                      {/* STATUS & CANCELLER BADGES */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-300 px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-800">
                            <CheckCheck className="h-4 w-4 text-emerald-700" />
                            Çəkiliş Oldu (Tamamlandı)
                          </span>
                        )}

                        {isConfirmed && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs sm:text-sm font-bold text-sky-800">
                            <span className="h-2.5 w-2.5 rounded-full bg-sky-600 animate-pulse" />
                            Gözləyir (Təsdiqli)
                          </span>
                        )}

                        {isCancelled && (
                          b.cancelledBy === 'client' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-300 px-3 py-1.5 text-xs sm:text-sm font-bold text-rose-800" title="Müştəri öz vauçeri və ya sayt vasitəsilə ləğv edib">
                              <XCircle className="h-4 w-4 text-rose-600" />
                              Müştəri Ləğv Etdi
                            </span>
                          ) : b.cancelledBy === 'admin' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-800" title="İnzibatçı studiya panelindən ləğv edib">
                              <XCircle className="h-4 w-4 text-amber-600" />
                              Studiya Ləğv Etdi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs sm:text-sm font-bold text-red-700">
                              <XCircle className="h-4 w-4 text-red-600" />
                              Ləğv Edilib
                            </span>
                          )
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* 1. Confirm Photoshoot Done / Completed */}
                          {isConfirmed && (
                            <button
                              type="button"
                              onClick={() => setCompletingBooking(b)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                              title="Müştəri gəldi və çəkiliş tamamlandı olaraq təsdiqlə"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Çəkiliş Oldu</span>
                            </button>
                          )}

                          {/* Revert Completed if misclicked */}
                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleRevertToConfirmed(b)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer mr-1"
                              title="Yenidən gözləyir statusuna qaytar"
                            >
                              Qaytar
                            </button>
                          )}

                          {/* Cancel button */}
                          {isConfirmed && (
                            <button
                              type="button"
                              onClick={() => setCancellingBooking(b)}
                              className="group flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 transition-all shadow-2xs cursor-pointer"
                              title="Studiya adından ləğv et və saatı boşalt"
                            >
                              <XCircle className="h-4 w-4 text-red-600 group-hover:scale-105 transition-transform" />
                              <span>Ləğv et</span>
                            </button>
                          )}

                          {/* Delete permanently */}
                          <button
                            type="button"
                            onClick={() => setDeletingBooking(b)}
                            className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Bazadan tamamilə sil"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION MODAL: "Çəkiliş Oldu (Tamamlandı)" */}
      {completingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 text-emerald-700 mb-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200">
                <CheckCircle2 className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Çəkilişi Təsdiqləyin</h3>
                <p className="text-xs sm:text-sm text-slate-500">Müştəri gəlib və çəkiliş tamamlanıb</p>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs sm:text-sm text-emerald-950 space-y-1 mb-4">
              <p><strong>Müştəri:</strong> {completingBooking.clientName}</p>
              <p><strong>Paket:</strong> {completingBooking.photoshootType}</p>
              <p><strong>Tarix & Saat:</strong> {completingBooking.date}, {completingBooking.timeSlot}</p>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              Bu çəkiliş <strong>"Tamamlandı"</strong> statusuna keçiriləcək və cari ayın tamamlanan çəkilişlər statistikasına daxil ediləcək.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompletingBooking(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCheck className="h-4 w-4" />
                <span>Bəli, Çəkiliş Oldu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: "Ləğv Et" (Studiya tərəfindən ləğv) */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 text-red-700 mb-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 border border-red-200">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bronu Ləğv Etmək?</h3>
                <p className="text-xs sm:text-sm text-slate-500">Studiya tərəfindən ləğvetmə qeyd ediləcək</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs sm:text-sm text-slate-800 space-y-1 mb-4">
              <p><strong>Müştəri:</strong> {cancellingBooking.clientName}</p>
              <p><strong>Tarix:</strong> {cancellingBooking.date}</p>
              <p><strong>Saat:</strong> {cancellingBooking.timeSlot}</p>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              Bu əməliyyat həmin saatı <strong>dərhal boşaldacaq</strong> və qeyddə <strong>"Studiya Ləğv Etdi"</strong> olaraq görünəcək.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                <span>Bəli, Studiya Adından Ləğv Et</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: "Sil" */}
      {deletingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Qeydi Tamamilə Silmək?</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-5">
              Bu qeyd bazadan həmişəlik silinəcək və geri qaytarmaq mümkün olmayacaq.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-xs cursor-pointer"
              >
                Tamamilə Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL BOOKING MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Manual Çəkiliş Əlavə Et</h3>
            <p className="text-xs text-slate-500 mb-4">Zənglə və ya şəxsən yazılan müştərilər üçün</p>

            {manualError && (
              <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                {manualError}
              </div>
            )}

            <form onSubmit={handleCreateManualBooking} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Müştəri Adı və Soyadı *</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Məs: Əli Məmmədov"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Əlaqə Nömrəsi</label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+994 50 123 45 67"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Çəkiliş Növü</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  {PHOTOSHOOT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Tarix</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Saat</label>
                  <select
                    value={manualSlot}
                    onChange={(e) => setManualSlot(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-800"
                  >
                    {ALL_TIME_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Qeydlər</label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="İstəklər..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Bağla
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-xs cursor-pointer"
                >
                  Əlavə Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP & STUDIO SETTINGS MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Studiya Tənzimləmələri</h3>
            <p className="text-xs text-slate-500 mb-4">
              Müştəri saytındakı əlaqə nömrəsi və ünvan məlumatlarını buradan yeniləyə bilərsiniz.
            </p>

            <form onSubmit={handleSaveWhatsApp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">WhatsApp Nömrəsi</label>
                <input
                  type="text"
                  required
                  value={studioWhatsApp}
                  onChange={(e) => setStudioWhatsApp(e.target.value)}
                  placeholder="+994 77 607 97 07"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Studiya Ünvanı</label>
                <input
                  type="text"
                  required
                  value={studioAddress}
                  onChange={(e) => setStudioAddress(e.target.value)}
                  placeholder="Hövsan, MİDA 1, Bina 1"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Rəsmi Studiya Loqosu */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Rəsmi Studiya Loqosu</label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex h-12 w-20 items-center justify-center bg-white rounded-lg border border-slate-200 p-1 shrink-0 overflow-hidden">
                    {adminLogoPreview ? (
                      <img src={adminLogoPreview} alt="Logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <EmgraphicEmblemSvg className="h-8 w-auto" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-block text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs">
                      {isUploadingLogo ? 'Yüklənir...' : 'Yeni Loqo Seç (PNG / JPG / SVG)'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoFileChange}
                        disabled={isUploadingLogo}
                      />
                    </label>
                    {adminLogoPreview && (
                      <button
                        type="button"
                        onClick={handleResetLogoToOfficial}
                        className="block text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Orijinal vektor loqoya qaytar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Bağla
                </button>
                <button
                  type="submit"
                  disabled={isSavingWhatsApp}
                  className="rounded-xl bg-[#F37021] hover:bg-[#e06216] px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all shadow-xs cursor-pointer"
                >
                  {isSavingWhatsApp ? 'Saxlanılır...' : 'Yadda Saxla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
