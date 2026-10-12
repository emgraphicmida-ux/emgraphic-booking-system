import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  X,
  Sparkles,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Booking } from '../types/booking';
import { apiService } from '../services/apiService';
import { EmgraphicLogo } from './EmgraphicLogo';
import { buildWhatsAppLink } from '../utils/whatsappUtils';

interface BookingConfirmationModalProps {
  booking: Booking | null;
  onClose: () => void;
  onBookingCancelled?: () => void;
}

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  booking,
  onClose,
  onBookingCancelled,
}) => {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studioWhatsApp, setStudioWhatsApp] = useState('+994 77 607 97 07');
  const [studioAddress, setStudioAddress] = useState('Hövsan, MİDA 1, Bina 1');

  // Load studio settings (WhatsApp & Address)
  useEffect(() => {
    let isMounted = true;
    apiService.getSettings().then((s) => {
      if (isMounted) {
        if (s?.whatsappNumber) setStudioWhatsApp(s.whatsappNumber);
        if (s?.studioAddress) setStudioAddress(s.studioAddress);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // ALWAYS reset confirmation/cancellation states when a new booking is provided
  useEffect(() => {
    setIsConfirmingCancel(false);
    setIsCancelling(false);
    setErrorMessage(null);
  }, [booking?.id]);

  if (!booking) return null;

  // Safe in-app cancellation
  const handleExecuteCancel = async () => {
    setIsCancelling(true);
    setErrorMessage(null);

    const res = await apiService.cancelBooking(booking.id);
    setIsCancelling(false);

    if (res.success) {
      setIsConfirmingCancel(false);
      onClose(); // Close modal
      if (onBookingCancelled) {
        onBookingCancelled();
      }
    } else {
      setErrorMessage(res.error || 'Qeydiyyat ləğv edilərkən xəta baş verdi.');
    }
  };

  const whatsappMessage = `Salam Emgraphic Studio! Mən çəkiliş rezerv etdim. Ad: ${booking.clientName}, Tarix: ${booking.date}, Saat: ${booking.timeSlot}, Çəkiliş növü: ${booking.photoshootType}`;
  const whatsappUrl = buildWhatsAppLink(studioWhatsApp, whatsappMessage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl text-left my-8">
        {/* Top-right dismiss button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Pəncərəni bağla"
        >
          <X className="h-5 w-5" />
        </button>

        {isConfirmingCancel ? (
          /* INLINE CANCELLATION CONFIRMATION DIALOG */
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Qeydiyyatı ləğv etmək istəyirsiniz?
                </h3>
                <p className="text-xs text-slate-500">
                  {booking.date} tarixində saat {booking.timeSlot} üçün olan çəkilişiniz ləğv ediləcək və saat digər müştərilər üçün boşaldılacaq.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleExecuteCancel}
                className="flex-1 rounded-full bg-red-600 py-2.5 px-4 text-xs font-bold text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ləğv edilir...</span>
                  </>
                ) : (
                  <span>Bəli, Qeydiyyatı Ləğv Et</span>
                )}
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setIsConfirmingCancel(false)}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 py-2.5 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Xeyr, Saxla
              </button>
            </div>
          </div>
        ) : (
          /* SUCCESSFUL REGISTRATION SUMMARY */
          <>
            {/* Top Success Icon & Heading */}
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-6 ring-emerald-50 mb-2.5">
                <CheckCircle2 className="h-7 w-7 stroke-[2.2]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Qeydiyyatınız Təsdiqləndi!
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                Emgraphic Studio-da çəkiliş vaxtınız uğurla rezerv edildi.
              </p>
            </div>

            {/* Notification alert */}
            <div className="mt-3.5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                Təsdiq bildirişi <strong className="text-slate-900">{booking.clientPhone}</strong> nömrəsinə göndərildi.
              </p>
            </div>

            {/* Booking Details Card (Clean, no reference code, no voucher header) */}
            <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 shadow-2xs">
              {/* Header with Studio Logo & Status */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2.5">
                <EmgraphicLogo size="sm" showSubtitle={false} />
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Təsdiqləndi
                </span>
              </div>

              {/* Details List */}
              <div className="p-4 space-y-3 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-slate-200">
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Müştəri</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">{booking.clientName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Əlaqə Nömrəsi</p>
                    <p className="font-mono-num font-bold text-slate-900 text-sm mt-0.5">{booking.clientPhone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-slate-200">
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Tarix</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-900 font-bold text-sm">
                      <Calendar className="h-4 w-4 text-[#F37021]" />
                      <span>{booking.date}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Çəkiliş Saatı</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-900 font-black font-mono-num text-base">
                      <Clock className="h-4 w-4 text-[#F37021]" />
                      <span>{booking.timeSlot}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-slate-200">
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Çəkiliş Növü</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">{booking.photoshootType}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Ünvan</p>
                    <a
                      href="https://maps.app.goo.gl/uKw9CnAKpEGXVrGm8"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 mt-0.5 text-slate-900 font-bold hover:text-[#F37021] transition-colors group text-sm"
                      title="Google Xəritədə açın"
                    >
                      <MapPin className="h-4 w-4 text-[#F37021] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span className="underline decoration-slate-300 hover:decoration-[#F37021]">{studioAddress} ↗</span>
                    </a>
                  </div>
                </div>

                {booking.notes && (
                  <div>
                    <p className="text-slate-500 text-xs font-medium">Qeydlər</p>
                    <p className="text-slate-800 text-xs sm:text-sm mt-0.5 italic">{booking.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: Red Rounded Cancel Button & WhatsApp */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Qırmızı kənarı dairəvi buton: Qeydiyyatı ləğv et */}
              <button
                type="button"
                onClick={() => setIsConfirmingCancel(true)}
                className="flex items-center justify-center gap-1.5 rounded-full border-2 border-red-500 bg-white hover:bg-red-50 text-red-600 px-4 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Çəkilişi ləğv et və saatı dərhal boşalt"
              >
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span>Qeydiyyatı ləğv et</span>
              </button>

              {/* WhatsApp ilə Əlaqə */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>WhatsApp ilə Əlaqə</span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
