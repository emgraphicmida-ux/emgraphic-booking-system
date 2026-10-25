import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Check, Calendar as CalendarIcon, Info } from 'lucide-react';
import { ALL_TIME_SLOTS } from '../types/booking';
import { getBakuNowDetails } from '../utils/bakuTime';

interface CalendarViewProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  isDateFullyBooked: (dateStr: string) => boolean;
  getAvailableSlotsCount: (dateStr: string) => number;
  todayDate?: string;
  maxDate?: string;
}

const MONTH_NAMES_AZ = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

const WEEKDAY_NAMES_AZ = ['B.e', 'Ç.a', 'Çər', 'C.a', 'Cüm', 'Şnb', 'Baz'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  isDateFullyBooked,
  getAvailableSlotsCount,
  todayDate,
  maxDate,
}) => {
  const bakuToday = getBakuNowDetails();
  const selectedParts = selectedDate ? selectedDate.split('-').map(Number) : null;
  const [currentYear, setCurrentYear] = useState<number>(selectedParts ? selectedParts[0] : bakuToday.year);
  const [currentMonth, setCurrentMonth] = useState<number>(selectedParts ? selectedParts[1] - 1 : bakuToday.month - 1);

  // Live real-time today date (automatically moves when day ends at midnight)
  const todayStr = todayDate || bakuToday.dateStr;
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const isFirstMonth = currentMonthKey <= todayStr.slice(0, 7);
  const isLastMonth = !!maxDate && currentMonthKey >= maxDate.slice(0, 7);

  const goToPrevMonth = () => {
    if (isFirstMonth) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (isLastMonth) return;
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const goToToday = () => {
    const b = getBakuNowDetails();
    setCurrentYear(b.year);
    setCurrentMonth(b.month - 1);
    onSelectDate(b.dateStr);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const leadingOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const totalSlotsCount = ALL_TIME_SLOTS.length;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 md:p-6 shadow-xs">
      {/* Month Navigation */}
      <div className="flex items-center justify-between gap-2 pb-3.5 sm:pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 sm:h-5 w-4 sm:w-5 text-[#F37021]" />
          <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900">
            {MONTH_NAMES_AZ[currentMonth]} {currentYear}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Bu gün
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={goToPrevMonth}
              disabled={isFirstMonth}
              className="rounded-md p-1 sm:p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Əvvəlki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToNextMonth}
              disabled={isLastMonth}
              className="rounded-md p-1 sm:p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Növbəti ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Names */}
      <div className="mt-3.5 grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs sm:text-sm font-bold text-slate-500">
        {WEEKDAY_NAMES_AZ.map((dayName, idx) => (
          <div
            key={dayName}
            className={`py-1.5 ${idx >= 5 ? 'text-[#F37021]' : 'text-slate-600'}`}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
        {/* Leading empty cells */}
        {Array.from({ length: leadingOffset }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[64px] sm:min-h-[76px] md:min-h-[84px] rounded-xl bg-slate-50/50 border border-transparent"
          />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const dayNumber = index + 1;
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
            dayNumber
          ).padStart(2, '0')}`;

          const isPast = dateStr < todayStr;
          const isOutsideWindow = !!maxDate && dateStr > maxDate;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const isFullyBooked = isDateFullyBooked(dateStr);
          const availableSlots = getAvailableSlotsCount(dateStr);
          const isPartiallyBooked = availableSlots > 0 && availableSlots < totalSlotsCount;

          // 1. KEÇMİŞ GÜNLƏR: Boz rəngdə, kliklənmir, işləmir və əsla "Dolu" yazılmır!
          if (isPast || isOutsideWindow) {
            return (
              <div
                key={dateStr}
                className="min-h-[58px] sm:min-h-[72px] md:min-h-[80px] p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-slate-400 cursor-not-allowed select-none flex flex-col justify-start"
                title={isOutsideWindow ? 'Bu tarix üçün qeydiyyat hələ açılmayıb' : 'Keçmiş gün'}
                aria-disabled="true"
              >
                <span className="font-mono-num text-sm sm:text-base md:text-lg font-semibold text-slate-400">
                  {dayNumber}
                </span>
              </div>
            );
          }

          // 2. YALNIZ BÜTÜN SAATLARI BRON EDİLMİŞ GÜNLƏR: QIRMIZI rənglənir və kilidlənir
          if (isFullyBooked) {
            return (
              <div
                key={dateStr}
                className="group relative flex flex-col justify-between min-h-[58px] sm:min-h-[72px] md:min-h-[80px] p-1.5 sm:p-2.5 rounded-xl border-2 border-red-300 bg-red-50 text-red-800 cursor-not-allowed select-none shadow-2xs"
                title="Bütün saatlar doludur! Bu günə qəbul tamamilə kilidlənib."
                aria-disabled="true"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-num text-base sm:text-lg md:text-xl font-black text-red-700">
                    {dayNumber}
                  </span>
                  <div className="flex h-4.5 w-4.5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-200 text-red-700">
                    <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </div>
                </div>

                <div className="mt-0.5">
                  <span className="inline-block text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight text-red-600 leading-tight">
                    Dolu
                  </span>
                </div>
              </div>
            );
          }

          // 3. Əgər bu gün üçün bütün saatlar bitibsə (lakin keçmiş gün deyil, bugündür)
          if (isToday && availableSlots === 0) {
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className={`group relative flex flex-col justify-between min-h-[58px] sm:min-h-[72px] md:min-h-[80px] p-1.5 sm:p-2.5 rounded-xl text-left transition-all duration-150 focus:outline-none cursor-pointer ${
                  isSelected
                    ? 'border-2 border-slate-900 bg-slate-100 shadow-sm'
                    : 'border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100/70'
                }`}
                title="Bugünkü iş saatları və qrafik"
                aria-label={dateStr}
              >
                <div className="flex w-full flex-wrap items-center justify-between gap-0.5">
                  <span className="font-mono-num text-base sm:text-lg md:text-xl font-black text-slate-900">
                    {dayNumber}
                  </span>
                  <span className="rounded bg-[#F37021] text-white px-1 sm:px-1.5 py-0.2 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide shadow-2xs">
                    Bugün
                  </span>
                </div>
                <div className="mt-0.5">
                  <span className="inline-block text-[10px] sm:text-[11px] font-bold text-slate-700 leading-tight">
                    Saatlar
                  </span>
                </div>
              </button>
            );
          }

          // Available or partially available days
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              aria-label={dateStr}
              className={`group relative flex flex-col justify-between min-h-[58px] sm:min-h-[72px] md:min-h-[80px] p-1.5 sm:p-2.5 rounded-xl text-left transition-all duration-150 focus:outline-none cursor-pointer ${
                isSelected
                  ? 'border-2 border-slate-900 bg-orange-50/40 shadow-xs ring-2 ring-slate-900/10'
                  : 'border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/90'
              }`}
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-0.5">
                <span
                  className="font-mono-num text-base sm:text-lg md:text-xl font-black text-slate-900"
                >
                  {dayNumber}
                </span>
                {isToday && (
                  <span className="rounded bg-amber-100 px-1 sm:px-1.5 py-0.2 text-[8px] sm:text-[9px] font-bold text-amber-900 uppercase">
                    Bugün
                  </span>
                )}
                {isSelected && !isToday && (
                  <div className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 stroke-[3]" />
                  </div>
                )}
              </div>

              <div className="mt-0.5">
                {isPartiallyBooked ? (
                  <span className="inline-block text-[9.5px] sm:text-[11px] font-bold text-amber-800 leading-tight">
                    {availableSlots} yer
                  </span>
                ) : (
                  <span className="inline-block text-[9px] sm:text-[10.5px] font-bold text-emerald-800 leading-tight tracking-tight">
                    Boşdur
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Simplified Legend */}
      <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5 text-xs sm:text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-50" />
            <span className="font-medium">Boş gün</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-50" />
            <span className="font-medium">Qismən dolu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-red-300 bg-red-100" />
            <span className="font-bold text-red-700 flex items-center gap-1">
              <Lock className="h-3 w-3 text-red-600" /> Dolu
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-100" />
            <span className="text-slate-400 font-medium">Keçmiş gün</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-semibold">
          <Info className="h-4 w-4 text-[#F37021] shrink-0" />
          <span>Ən azı 30 dəqiqə öncədən • 10:00–20:00 • 30 dəqiqəlik seçimlər{maxDate ? ` • Son tarix: ${maxDate}` : ''}</span>
        </div>
      </div>
    </div>
  );
};
