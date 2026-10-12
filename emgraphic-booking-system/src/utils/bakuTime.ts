/**
 * Official Baku, Azerbaijan Time Utility (Asia/Baku, UTC+4)
 * Azerbaijan discontinued daylight saving time in 2016.
 * Baku is permanently fixed at UTC+4 all year round.
 */

export const BAKU_TIMEZONE = 'Asia/Baku';

export interface BakuTimeDetails {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string; // YYYY-MM-DD in Baku
  timeStr: string; // HH:mm in Baku
  decimalHour: number; // e.g. 14.5 for 14:30
  timestamp: number;
}

/**
 * Returns exact current date and time components in Baku timezone (Asia/Baku)
 */
export function getBakuNowDetails(baseDate: Date = new Date()): BakuTimeDetails {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BAKU_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10) || baseDate.getFullYear();
  const month = parseInt(getPart('month'), 10) || baseDate.getMonth() + 1;
  const day = parseInt(getPart('day'), 10) || baseDate.getDate();

  let hour = parseInt(getPart('hour'), 10);
  if (hour === 24) hour = 0;

  const minute = parseInt(getPart('minute'), 10) || 0;
  const second = parseInt(getPart('second'), 10) || 0;

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const decimalHour = hour + minute / 60;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    timeStr,
    decimalHour,
    timestamp: baseDate.getTime(),
  };
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Baku time
 */
export function getBakuTodayStr(baseDate?: Date): string {
  return getBakuNowDetails(baseDate).dateStr;
}

/**
 * Returns current time formatted as HH:mm in Baku time
 */
export function getBakuCurrentTimeStr(baseDate?: Date): string {
  return getBakuNowDetails(baseDate).timeStr;
}

/**
 * Checks whether a given YYYY-MM-DD date is strictly in the past relative to Baku today
 */
export function isDateInPastBaku(targetDateStr: string): boolean {
  const todayBaku = getBakuTodayStr();
  return targetDateStr < todayBaku;
}

/**
 * Formats a date string (YYYY-MM-DD) into Azerbaijani readable text
 * e.g., "4 Oktyabr 2026, Bazar"
 */
export function formatBakuDateAz(dateStr: string): string {
  if (!dateStr) return '';
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (!year || !month || !day) return dateStr;

  const monthNamesAz = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
    'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
  ];

  // Construct a standard UTC midday date to determine day of week accurately
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekDaysAz = [
    'Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə',
    'Cümə axşamı', 'Cümə', 'Şənbə',
  ];

  const monthName = monthNamesAz[month - 1] || '';
  const weekDay = weekDaysAz[d.getUTCDay()] || '';

  return `${day} ${monthName} ${year}, ${weekDay}`;
}

/**
 * Formats an ISO string or Date into Baku local time string:
 * e.g. "04.10.2026, 20:00"
 */
export function formatDateTimeAzBaku(dateOrIso: string | Date): string {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return String(dateOrIso);

  const details = getBakuNowDetails(d);
  return `${String(details.day).padStart(2, '0')}.${String(details.month).padStart(2, '0')}.${details.year}, ${details.timeStr}`;
}
