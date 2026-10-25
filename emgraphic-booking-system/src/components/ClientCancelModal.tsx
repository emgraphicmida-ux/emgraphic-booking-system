import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Phone, Calendar, Clock, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Booking } from '../types/booking';
import {
  extractAzDigits,
  formatAzLocalNumber,
} from '../utils/phoneUtils';
import { apiService } from '../services/apiService';
import { bookingStartsAt } from '../utils/attendance';
import { canClientCancelBooking, CANCELLATION_CLOSED_MESSAGE } from '../utils/cancellation';
import { buildWhatsAppLink } from '../utils/whatsappUtils';
import { useNow } from '../hooks/useNow';
import { getNowMs } from '../utils/clock';
import { CustomerModal } from './CustomerModal';

interface ClientCancelModalProps {
  onClose: () => void;
  onBookingCancelled: () => void;
}

export const ClientCancelModal: React.FC<ClientCancelModalProps> = ({
  onClose,
  onBookingCancelled,
}) => {
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const now = useNow();
  const [studioWhatsApp, setStudioWhatsApp] = useState('+994 77 607 97 07');
  useEffect(() => { let active = true; apiService.getSettings().then(s => { if (active && s.whatsappNumber) setStudioWhatsApp(s.whatsappNumber); }); return () => { active = false; }; }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [pendingCancelBooking, setPendingCancelBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelledCode, setCancelledCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load only this customer's bookings via their device's secret tokens
  const loadMyBookings = async (phoneQuery?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLoadFailed(false);
    try {
      const results = await apiService.getMyBookings(phoneQuery);
      setMyBookings(results.filter((b) => b.status === 'confirmed' && bookingStartsAt(b) > getNowMs()));
    } catch {
      setLoadFailed(true);
      setErrorMessage('Qeydiyyatlar yüklənmədi. Serverlə əlaqəni yoxlayıb yenidən cəhd edin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyBookings();
  }, []);

  const handlePhoneSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSearch.trim()) return;

    setIsSearchingPhone(true);
    setErrorMessage(null);
    setLoadFailed(false);
    try {
      const results = await apiService.getMyBookings(phoneSearch.trim());
      const activeOnly = results.filter((b) => b.status === 'confirmed' && bookingStartsAt(b) > getNowMs());
      setMyBookings(activeOnly);
      if (activeOnly.length === 0) {
        setErrorMessage('Daxil etdiyiniz nömrəyə aid aktiv qeydiyyat tapılmadı.');
      }
    } catch {
      setLoadFailed(true);
      setErrorMessage('Axtarışı tamamlamaq mümkün olmadı. Yenidən cəhd edin.');
    } finally {
      setIsSearchingPhone(false);
    }
  };

  // Safe in-app cancellation (NO window.confirm!)
  const handleExecuteCancel = async () => {
    if (!pendingCancelBooking) return;

    setIsCancelling(true);
    setErrorMessage(null);

    const res = await apiService.cancelBooking(pendingCancelBooking.id);

    setIsCancelling(false);

    if (res.success) {
      setCancelledCode(pendingCancelBooking.referenceCode);
      setPendingCancelBooking(null);
      onBookingCancelled();
    } else {
      setErrorMessage(res.error || 'Qeydiyyat ləğv edilərkən xəta baş verdi.');
    }
  };

  return (
    <CustomerModal title="Qeydiyyatı Ləğv Et" onClose={onClose} busy={isCancelling} compact>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isCancelling}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Bağla"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Qeydiyyatı Ləğv Et</h3>
            <p className="text-xs text-slate-500">Yalnız öz sifarişinizi ləğv edib saatı boşaldın</p>
          </div>
        </div>

        {/* SUCCESS SCREEN */}
        {cancelledCode ? (
          <div className="mt-4 text-center py-4 space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Qeydiyyatınız Uğurla Ləğv Edildi!
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Çəkiliş qeydiyyatınız ləğv olundu və həmin saat aralığı təqvimdə dərhal digər şəxslər üçün boşaldıldı.
            </p>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Pəncərəni Bağla
              </button>
            </div>
          </div>
        ) : pendingCancelBooking ? (
          /* CONFIRMATION SCREEN (Inline UI, no window.confirm) */
          <div className="py-4 space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-2 text-xs">
              <p className="font-bold text-red-900">
                Ləğv etmək istədiyinizdən əminsiniz?
              </p>
              <div className="text-slate-700 space-y-1">
                <p>
                  Müştəri: <strong>{pendingCancelBooking.clientName}</strong>
                </p>
                <p>
                  Tarix: <strong>{pendingCancelBooking.date}</strong> | Saat:{' '}
                  <strong>{pendingCancelBooking.timeSlot}</strong>
                </p>
              </div>
              <p className="text-[11px] text-red-700 pt-1">
                Təsdiqlədiyiniz halda bu saat dərhal təqvimdə yenidən boşalacaq.
              </p>
            </div>

            {!canClientCancelBooking(pendingCancelBooking, now) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{CANCELLATION_CLOSED_MESSAGE}</p>}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isCancelling || !canClientCancelBooking(pendingCancelBooking, now)}
                onClick={handleExecuteCancel}
                className="flex-1 rounded-xl bg-red-600 py-2.5 px-3 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ləğv edilir...</span>
                  </>
                ) : (
                  <span>Bəli, Ləğv Et</span>
                )}
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setPendingCancelBooking(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                İmtina
              </button>
            </div>
          </div>
        ) : (
          /* LIST OF ONLY THIS CUSTOMER'S BOOKINGS */
          <div className="mt-4 space-y-3.5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                <Loader2 className="h-5 w-5 animate-spin text-[#F37021]" />
                <span>Qeydiyyatınız yoxlanılır...</span>
              </div>
            ) : loadFailed ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3 text-xs text-red-800">
                <p>{errorMessage}</p>
                <button type="button" onClick={() => loadMyBookings(phoneSearch || undefined)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold">
                  <RefreshCw className="h-4 w-4" />Yenidən yoxla
                </button>
              </div>
            ) : myBookings.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-700">
                  Sizin bu cihazda aktiv qeydiyyatlarınız:
                </p>
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-semibold text-slate-900">
                        {b.clientName}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {b.photoshootType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-slate-600 text-[11.5px]">
                      <div>
                        <span>Müştəri: </span>
                        <strong className="text-slate-900">{b.clientName}</strong>
                      </div>
                      <div>
                        <span>Tarix: </span>
                        <strong className="text-slate-900">{b.date}</strong>
                      </div>
                      <div className="col-span-2">
                        <span>Saat: </span>
                        <strong className="text-[#F37021] font-mono-num">{b.timeSlot}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canClientCancelBooking(b, now)}
                      onClick={() => setPendingCancelBooking(b)}
                      className="w-full rounded-xl bg-red-600 py-2 px-3 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Bu Qeydiyyatı Ləğv Et</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    {!canClientCancelBooking(b, now) && <div className="space-y-2"><p className="text-xs leading-relaxed text-amber-800">{CANCELLATION_CLOSED_MESSAGE}</p><a href={buildWhatsAppLink(studioWhatsApp, 'Salam! ' + b.date + ' saat ' + b.timeSlot + ' üçün qeydiyyatımı ləğv etmək istəyirəm. Bron kodu: ' + b.referenceCode)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><Phone size={14}/>Studiya ilə əlaqə</a></div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 text-center">
                  Bu cihazda hələ heç bir aktiv qeydiyyat tapılmadı.
                </div>

                <form onSubmit={handlePhoneSearchSubmit} noValidate className="space-y-2 pt-1">
                  <label htmlFor="cancel-phone-search" className="block text-xs font-semibold text-slate-700">
                    Bu cihazda yaratdığınız qeydiyyatı nömrə ilə süzün:
                  </label>
                  <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-slate-800">
                    <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-2 border-r border-slate-200 select-none shrink-0 text-xs font-mono font-semibold text-slate-700">
                      <span>🇦🇿</span>
                      <span>+994</span>
                    </div>
                    <input
                      id="cancel-phone-search"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={32}
                      required
                      value={formatAzLocalNumber(phoneSearch)}
                      onChange={(e) => setPhoneSearch(extractAzDigits(e.target.value))}
                      onPaste={event => {
                        event.preventDefault();
                        setPhoneSearch(extractAzDigits(event.clipboardData.getData('text')));
                      }}
                      placeholder="50 123 45 67"
                      className="min-w-0 flex-1 py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-mono bg-transparent"
                    />
                    <button
                      type="submit"
                      disabled={isSearchingPhone}
                      className="bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isSearchingPhone ? '...' : 'Göstər'}
                    </button>
                  </div>
                </form>
                <p className="text-[11px] leading-relaxed text-slate-500">Başqa cihazda etdiyiniz qeydiyyatı həmin cihazdan ləğv edin. Cihaza girişiniz yoxdursa, studiya ilə əlaqə saxlayın. Təkcə nömrə şəxsi məlumatları görmək və bronu ləğv etmək üçün kifayət etmir.</p>

                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </CustomerModal>
  );
};
