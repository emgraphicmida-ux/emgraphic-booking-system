import React, { useState } from 'react';
import type { Booking } from '../types/booking';
import { getBakuTodayStr } from '../utils/bakuTime';
import { getMonthlyBookingStats } from '../utils/bookingStatistics';

export function MonthlyStatistics({ bookings, now }: { bookings: Booking[]; now: number }) {
  const currentMonth = getBakuTodayStr(new Date(now)).slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const summary = getMonthlyBookingStats(bookings, month, now);
  return <section aria-label="Aylıq statistika" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold text-slate-900">Aylıq statistika</h2><input aria-label="Statistika ayı" type="month" max={currentMonth} required className="admin-input !w-auto" value={month} onChange={e => setMonth(e.target.value || currentMonth)}/></div>
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-[#182132] p-4 text-white sm:p-5"><dt className="text-xs text-slate-300">Çəkiliş oldu</dt><dd data-stat="shoots" className="mt-3 text-4xl font-bold">{summary.shoots}</dd></div>
      <div className="rounded-xl bg-rose-50 p-4 text-rose-900 sm:p-5"><dt className="text-xs text-rose-700">Ləğv olundu</dt><dd data-stat="cancelled" className="mt-3 text-4xl font-bold">{summary.cancelled}</dd></div>
    </dl>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Çəkiliş sayı vaxtı bitmiş, ləğv edilməmiş bronlara əsaslanır. Ay çəkiliş tarixinə görə hesablanır.</p>
  </section>;
}
