import React from 'react';
import {
  Clock,
  Lock,
  Check,
  AlertCircle,
  Info,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';
import { ALL_TIME_SLOTS, isSameOrMatchingSlot } from '../types/booking';
import {
  checkSlotAdvanceStatus,
  getBookableSlotsForDate,
} from '../utils/bookingRules';
import { formatBakuDateAz, getBakuNowDetails } from '../utils/bakuTime';

interface TimeSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  bookedSlots: string[];
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedDate,
  selectedSlot,
  onSelectSlot,
  bookedSlots,
}) => {
  const bookableSlots = getBookableSlotsForDate(selectedDate, bookedSlots);
  const availableCount = bookableSlots.length;
  const bookedCount = bookedSlots.length;
  const bakuNow = getBakuNowDetails();
  const isToday = selectedDate === bakuNow.dateStr;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 md:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#F37021]">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
              Çəkiliş Saatları
            </h3>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
            <span className="font-bold text-slate-900">{formatBakuDateAz(selectedDate)}</span> • İş saatları: 10:00 - 20:00
          </p>
        </div>

        {/* Counter Badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 px-3 py-1.5 text-emerald-800 font-extrabold text-xs sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            {availableCount} boş saat
          </span>
          {bookedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200/70 px-3 py-1.5 text-red-800 font-bold text-xs sm:text-sm">
              <Lock className="h-3.5 w-3.5 text-red-600" />
              {bookedCount} dolu
            </span>
          )}
        </div>
      </div>

      {/* Info notice */}
      <div className="mt-3.5 flex items-center gap-2.5 rounded-xl bg-amber-50/90 border border-amber-200/70 px-3.5 py-2.5 text-xs sm:text-sm text-amber-950">
        <Info className="h-4 w-4 text-[#F37021] shrink-0" />
        <p className="leading-snug">
          {isToday ? (
            <span>
              <strong>Canlı qrafik:</strong> Cari vaxtdan keçmiş saatlar avtomatik bağlanır, açıq saatlar dərhal rezervasiya edilə bilər.
            </span>
          ) : (
            <span>
              <strong>İş qrafiki:</strong> Çəkiliş saatları 10:00-dan 20:00-dəkdir. İstədiyiniz uyğun saatın üzərinə vurun.
            </span>
          )}
        </p>
      </div>

      {/* Selected Slot Notice */}
      {selectedSlot && (
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-950 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4.5 w-4.5 text-emerald-700 shrink-0" />
            <span>
              Seçilmiş vaxt: <strong className="font-mono-num text-sm sm:text-base font-black text-slate-900">{selectedSlot}</strong>
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
            <Check className="h-3 w-3 stroke-[3]" /> Seçildi
          </span>
        </div>
      )}

      {/* Time Slots Grid - Clean, high contrast, responsive for mobile & desktop */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {ALL_TIME_SLOTS.map((slot) => {
          const isBooked = bookedSlots.some((b) => isSameOrMatchingSlot(b, slot));
          const advanceCheck = checkSlotAdvanceStatus(selectedDate, slot);
          const isSelected = selectedSlot === slot || (selectedSlot ? isSameOrMatchingSlot(selectedSlot, slot) : false);

          // 1. Dolu saat (artıq bron edilib)
          if (isBooked) {
            return (
              <div
                key={slot}
                className="relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border border-red-200/90 bg-red-50/40 text-center select-none cursor-not-allowed opacity-80"
                title="Bu saat artıq başqa müştəri tərəfindən bron edilib."
                aria-disabled="true"
              >
                <span className="font-mono-num text-base sm:text-lg md:text-xl font-bold text-slate-500 tracking-tight">
                  {slot}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700 bg-red-100/90 px-2 py-0.5 rounded-full">
                  <Lock className="h-3 w-3 text-red-600 shrink-0" />
                  Dolu
                </span>
              </div>
            );
          }

          // 2. Qapalı və ya keçmiş saat
          if (!advanceCheck.isBookable) {
            return (
              <div
                key={slot}
                className="relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border border-slate-200 bg-slate-100/80 text-center select-none cursor-not-allowed opacity-70"
                title={advanceCheck.status === 'insufficient_advance' ? 'Çəkilişə öncədən yazılmaq lazımdır.' : 'Bu saat artıq keçib.'}
                aria-disabled="true"
              >
                <span className="font-mono-num text-base sm:text-lg md:text-xl font-semibold text-slate-400 tracking-tight">
                  {slot}
                </span>
                <span className="mt-1 inline-flex items-center text-[11px] font-semibold text-slate-500 bg-slate-200/90 px-2 py-0.5 rounded-full">
                  {advanceCheck.label || 'Keçib'}
                </span>
              </div>
            );
          }

          // 3. Seçilmiş saat (aktiv)
          if (isSelected) {
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className="group relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 border-slate-900 bg-slate-900 text-white shadow-md ring-3 ring-orange-500/25 transition-all transform active:scale-95 cursor-pointer text-center"
                aria-selected="true"
              >
                <span className="font-mono-num text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">
                  {slot}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-orange-300 bg-white/10 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3 stroke-[3]" />
                  Seçildi
                </span>
              </button>
            );
          }

          // 4. Boş saat (rezervasiyaya açıqdır)
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSelectSlot(slot)}
              className="group relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 border-slate-200 bg-white text-slate-900 shadow-2xs hover:border-[#F37021] hover:bg-orange-50/20 hover:shadow-xs transition-all duration-150 transform active:scale-95 cursor-pointer text-center"
              title={`${slot} saatını seçmək üçün vurun`}
            >
              <span className="font-mono-num text-lg sm:text-xl md:text-2xl font-black text-slate-900 group-hover:text-[#F37021] transition-colors tracking-tight">
                {slot}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Boş
              </span>
            </button>
          );
        })}
      </div>

      {availableCount === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 text-[#F37021] shrink-0" />
          <p>
            Bu günün bütün iş saatları artıq başa çatıb və ya bron edilib. Zəhmət olmasa təqvimdən başqa bir tarixi seçin.
          </p>
        </div>
      )}
    </div>
  );
};
