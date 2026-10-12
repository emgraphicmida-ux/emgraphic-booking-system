import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { TimeSlotPicker } from './components/TimeSlotPicker';
import { BookingForm } from './components/BookingForm';
import { BookingConfirmationModal } from './components/BookingConfirmationModal';
import { ClientCancelModal } from './components/ClientCancelModal';
import { WhatsAppFloatingButton } from './components/WhatsAppFloatingButton';
import { AdminPortal } from './components/AdminPortal';
import { Booking, ALL_TIME_SLOTS, PhotoshootType, PublicSlotStatus, isSameOrMatchingSlot } from './types/booking';
import { apiService } from './services/apiService';
import { getBookableSlotsForDate } from './utils/bookingRules';
import { getBakuTodayStr, formatBakuDateAz } from './utils/bakuTime';
import { Lock, Clock, Calendar as CalendarIcon, X, XCircle, CheckCircle2, Loader2, CalendarCheck, MapPin } from 'lucide-react';

export default function App() {
  // By default, show the customer booking website.
  // Only enter admin mode if explicitly navigating to #admin, /admin, or secret shortcut
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash === '#admin' ||
      window.location.pathname === '/admin' ||
      window.location.search.includes('view=admin')
    );
  });

  useEffect(() => {
    // 1. URL listener
    const handlePopState = () => {
      if (
        window.location.hash === '#admin' ||
        window.location.pathname === '/admin' ||
        window.location.search.includes('view=admin')
      ) {
        setIsAdminMode(true);
      } else {
        setIsAdminMode(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    // 2. Secret keyboard shortcut: Alt + A or Ctrl + Shift + A
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && (e.key === 'a' || e.key === 'A')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))
      ) {
        e.preventDefault();
        try {
          window.location.hash = 'admin';
        } catch {}
        setIsAdminMode(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenAdmin = () => {
    try {
      window.location.hash = 'admin';
    } catch {}
    setIsAdminMode(true);
  };

  if (isAdminMode) {
    return (
      <AdminPortal
        onExit={() => {
          setIsAdminMode(false);
          try {
            window.location.hash = '';
            window.history.replaceState(null, '', '/');
          } catch {}
        }}
      />
    );
  }

  // Public availability: ONLY { date, timeSlot } of booked hours.
  // CRITICAL PRIVACY: NO names, NO phones, NO private notes of other customers!
  const [bookedSlots, setBookedSlots] = useState<PublicSlotStatus[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(true);

  // ONLY this customer's own booking(s)
  const [myActiveBooking, setMyActiveBooking] = useState<Booking | null>(null);

  // Selection states
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [formServerError, setFormServerError] = useState<string | null>(null);

  const bookingSectionRef = useRef<HTMLDivElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // 1. Fetch public availability (strictly dates and times, 0 personal info)
  const refreshAvailability = async () => {
    try {
      const slots = await apiService.getAvailability();
      setBookedSlots(slots);
    } catch (e) {
      console.error('Error refreshing availability:', e);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // 2. Fetch ONLY this user's own booking on this device
  const refreshMyBookings = async () => {
    try {
      const activeRes = await apiService.checkMyActiveBooking();
      if (activeRes.hasActiveBooking && activeRes.activeBooking) {
        setMyActiveBooking(activeRes.activeBooking);
      } else {
        const myBookings = await apiService.getMyBookings();
        const active = myBookings.find((b) => b.status === 'confirmed');
        setMyActiveBooking(active || null);
      }
    } catch (e) {
      console.error('Error fetching my bookings:', e);
    }
  };

  // Live real-time date tracking (automatically rolls over at midnight)
  const [bakuLiveDate, setBakuLiveDate] = useState<string>(() => getBakuTodayStr());
  const [, setLiveClockTick] = useState<number>(0);

  useEffect(() => {
    refreshAvailability();
    refreshMyBookings();

    // Auto-advance in sync with live clock every 10 seconds:
    // 1. Checks if midnight arrived (day ends): rolls date forward, turns old date into past, reloads availability
    // 2. Ticks forward so slots dynamically lock when their 2-hour buffer or time arrives
    const timer = setInterval(() => {
      const currentToday = getBakuTodayStr();
      setBakuLiveDate((prevDate) => {
        if (prevDate !== currentToday) {
          // Gün bitdi: Canlı saatla birlikdə təqvim növbəti günə keçir
          refreshAvailability();
          setSelectedDate((curSelected) => {
            if (curSelected && curSelected < currentToday) {
              return null; // Keçmiş gün seçilibsə, təmizlə
            }
            return curSelected;
          });
          return currentToday;
        }
        return prevDate;
      });

      // Dinamik vaxt yenilənməsi
      setLiveClockTick((prev) => prev + 1);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const getTodayStr = (): string => {
    return bakuLiveDate;
  };

  // Helper calculations based on public bookings AND advance booking rules
  const getBookedSlotsForDate = (dateStr: string): string[] => {
    return bookedSlots
      .filter((s) => s.date === dateStr)
      .map((s) => s.timeSlot);
  };

  const getAvailableSlotsCount = (dateStr: string): number => {
    const bookedOnDate = getBookedSlotsForDate(dateStr);
    return getBookableSlotsForDate(dateStr, bookedOnDate).length;
  };

  // Yalnız bu gün və gələcəkdə bütün saatları müştərilər tərəfindən bron edilmiş günlər "Dolu" sayılır
  // Keçmiş günlər qətiyyən "Dolu" deyil, sadəcə keçmişdir.
  const isDateFullyBooked = (dateStr: string): boolean => {
    if (dateStr < getTodayStr()) return false;
    const bookedOnDate = getBookedSlotsForDate(dateStr);
    return ALL_TIME_SLOTS.every((slot) =>
      bookedOnDate.some((b) => isSameOrMatchingSlot(b, slot))
    );
  };

  // Tarixin üzərinə vurulan zaman saat və yazmaq olan bölmə açılsın
  const handleSelectDate = (dateStr: string) => {
    // 1. Keçmiş tarixlər seçilə bilməz və işləmir
    if (dateStr < getTodayStr()) {
      return;
    }
    // 2. Tam dolu günlər seçilə bilməz
    if (isDateFullyBooked(dateStr)) {
      return;
    }

    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setFormServerError(null);

    // Smoothly scroll down to the time & form section
    setTimeout(() => {
      bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    setFormServerError(null);
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleFormSubmit = async (formData: {
    clientName: string;
    clientPhone: string;
    photoshootType: PhotoshootType;
    notes?: string;
  }) => {
    if (!selectedDate || !selectedSlot) return;

    setIsSubmitting(true);
    setFormServerError(null);

    const res = await apiService.createBooking({
      clientName: formData.clientName,
      clientPhone: formData.clientPhone,
      photoshootType: formData.photoshootType,
      date: selectedDate,
      timeSlot: selectedSlot,
      notes: formData.notes,
    });
    setIsSubmitting(false);

    if (res.success && res.booking) {
      setFormServerError(null);
      // Refresh real-time availability on server
      await refreshAvailability();
      await refreshMyBookings();

      setConfirmedBooking(res.booking);
      setSelectedSlot(null);
    } else {
      setFormServerError(res.error || 'Qeydiyyat zamanı xəta baş verdi.');
    }
  };

  const handleBookingCancelled = async () => {
    await refreshAvailability();
    await refreshMyBookings();
    setActionToast('Qeydiyyatınız uğurla ləğv edildi və saat dərhal boşaldıldı.');
    setTimeout(() => setActionToast(null), 5000);
  };

  const currentDayBookedSlots = selectedDate ? getBookedSlotsForDate(selectedDate) : [];
  const currentDayIsFull = selectedDate ? isDateFullyBooked(selectedDate) : false;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 antialiased selection:bg-amber-100 flex flex-col justify-between">
      <div>
        {/* Header - Minimal, official logo on left */}
        <Header
          onResetSelection={() => setSelectedDate(null)}
          onSecretAdminTrigger={handleOpenAdmin}
        />

        {/* Main Content */}
        <main className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-6 md:py-8">
          {/* Action notification toast */}
          {actionToast && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs sm:text-sm text-emerald-900 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{actionToast}</span>
              </div>
              <button
                onClick={() => setActionToast(null)}
                className="text-emerald-700 font-bold ml-2 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="space-y-6 sm:space-y-7">
            {/* Title & Official Address */}
            <div className="border-b border-slate-200/80 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3.5">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                  Çəkiliş qeydiyyatı
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-slate-600">
                  {selectedDate
                    ? 'Tarix seçildi. İndi saatı seçib məlumatlarınızı qeyd edin.'
                    : 'Çəkiliş üçün təqvimdən sizə uyğun günün üzərinə vurun.'}
                </p>
              </div>

              {/* Official Studio Address Badge (Google Maps link) */}
              <a
                href="https://maps.app.goo.gl/uKw9CnAKpEGXVrGm8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:text-[#F37021] hover:border-[#F37021] hover:bg-orange-50/40 transition-all shadow-xs group cursor-pointer w-full sm:w-auto justify-center sm:justify-start"
                title="Ünvanı Google Xəritədə açın"
              >
                <MapPin className="h-4 w-4 text-[#F37021] shrink-0 group-hover:scale-115 transition-transform" />
                <span>
                  <strong className="text-slate-900">Ünvan:</strong> Hövsan, MİDA 1, Bina 1 <span className="text-xs text-[#F37021] font-bold underline decoration-orange-300 ml-1">Xəritədə bax ↗</span>
                </span>
              </a>
            </div>

            {/* Active Booking Reminder Card */}
            {myActiveBooking && (
              <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F37021] text-white shadow-xs">
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#F37021]">
                          Aktiv Qeydiyyatınız Mövcuddur
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-900">
                        {myActiveBooking.clientName} — {myActiveBooking.date}, {myActiveBooking.timeSlot}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Qaydalarımıza əsasən hər müştəri eyni vaxtda yalnız 1 aktiv saat seçə bilər. Vaxtı dəyişmək üçün mövcud qeydiyyatı ləğv edin.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmedBooking(myActiveBooking)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Vauçerə Bax
                    </button>
                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-2xs"
                    >
                      Qeydiyyatı Ləğv Et
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 1. Təqvim Hissəsi */}
            <div>
              {isLoadingSlots ? (
                <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-[#F37021]" />
                  <span>Təqvim yüklənir...</span>
                </div>
              ) : (
                <CalendarView
                  selectedDate={selectedDate || ''}
                  onSelectDate={handleSelectDate}
                  isDateFullyBooked={isDateFullyBooked}
                  getAvailableSlotsCount={getAvailableSlotsCount}
                  todayDate={bakuLiveDate}
                />
              )}
            </div>

            {/* Əgər heç bir tarix seçilməyibsə: Aydın və sadə bələdçi bildiriş */}
            {!selectedDate && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:p-8 text-center text-slate-500 shadow-2xs">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[#F37021] mb-2.5">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Tarix seçilməyib
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Saatları və müraciət formasını açmaq üçün yuxarıdakı təqvimdən istədiyiniz günün üzərinə vurun.
                </p>
              </div>
            )}

            {/* 2. Yazmaq və Saat olan bölmə: YALNIZ TARİXİN ÜZƏRİNƏ VURULAN ZAMAN ÇIXIR */}
            {selectedDate && (
              <div
                ref={bookingSectionRef}
                className="space-y-5 pt-3 border-t border-slate-200 scroll-mt-20 animate-in fade-in duration-300"
              >
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#F37021]" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Seçilmiş Gün: <span className="text-[#F37021]">{selectedDate}</span>
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDate(null);
                      setSelectedSlot(null);
                    }}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Bağla / Başqa gün</span>
                  </button>
                </div>

                {currentDayIsFull ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-red-100 mb-2">
                      <Lock className="h-4 w-4 text-red-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Bu günün bütün saatları doludur</h3>
                    <p className="mt-1 text-xs text-red-700">
                      Zəhmət olmasa təqvimdən başqa bir gün seçin.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Saat Seçimi (10:00 - 20:00) */}
                    <div className={`${selectedSlot ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
                      <TimeSlotPicker
                        selectedDate={selectedDate}
                        selectedSlot={selectedSlot}
                        onSelectSlot={handleSelectSlot}
                        bookedSlots={currentDayBookedSlots}
                      />
                    </div>

                    {/* Yazmaq üçün Forma: Hər hansı saatın üzərinə klik edildikdə açılır */}
                    {selectedSlot && (
                      <div className="lg:col-span-5 animate-in fade-in slide-in-from-top-2 duration-300" ref={formSectionRef}>
                        <BookingForm
                          selectedDate={selectedDate}
                          selectedSlot={selectedSlot}
                          onSubmit={handleFormSubmit}
                          isSubmitting={isSubmitting}
                          serverError={formServerError}
                          onOpenCancelModal={() => setIsCancelModalOpen(true)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer - Completely clean, no admin button visible to clients */}
      <footer className="mt-12 border-t border-slate-200/80 bg-white py-5 px-4 text-xs sm:text-sm text-slate-500">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p
            onClick={() => {
              // Secret 3 taps on copyright triggers Admin Portal for owner
              const key = '__footer_tap_count';
              const cur = (window as any)[key] || 0;
              (window as any)[key] = cur + 1;
              if ((window as any)[key] >= 3) {
                (window as any)[key] = 0;
                handleOpenAdmin();
              } else {
                setTimeout(() => {
                  (window as any)[key] = 0;
                }, 2000);
              }
            }}
            className="cursor-default select-none hover:text-slate-600 transition-colors"
            title="Emgraphic Studio"
          >
            © {new Date().getFullYear()} Emgraphic Studio. Bütün hüquqlar qorunur.
          </p>

          <a
            href="https://maps.app.goo.gl/uKw9CnAKpEGXVrGm8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-[#F37021] transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 text-[#F37021]" />
            <span>Hövsan, MİDA 1, Bina 1 (Xəritədə bax ↗)</span>
          </a>
        </div>
      </footer>

      {/* Confirmation Modal with Safe In-App Cancel */}
      {confirmedBooking && (
        <BookingConfirmationModal
          key={confirmedBooking.id}
          booking={confirmedBooking}
          onClose={() => setConfirmedBooking(null)}
          onBookingCancelled={() => {
            setConfirmedBooking(null);
            handleBookingCancelled();
          }}
        />
      )}

      {/* Customer Cancellation Modal (Private to customer) */}
      {isCancelModalOpen && (
        <ClientCancelModal
          onClose={() => setIsCancelModalOpen(false)}
          onBookingCancelled={handleBookingCancelled}
        />
      )}

      {/* Floating WhatsApp Live Contact Button */}
      <WhatsAppFloatingButton />
    </div>
  );
}
