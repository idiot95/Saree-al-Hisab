import { HIJRI_MONTHS_SHORT, toHijri } from '@/lib/hijri';

/* The calendar's plain date arithmetic, apart from the calendar itself: HijriCalendar.tsx (react-day-picker, about
   26KB gz) is loaded only when a month grid opens (LazyCalendar.tsx), and the screens that only need a month's name
   or a date's parts import from here. Dates go in and out as plain YYYY-MM-DD; the Date objects react-day-picker
   wants are local midnights made here, so nothing shifts across a time zone. */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
export const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
export const dateOf = (iso: string) => { const c = civil(iso); return new Date(c.y, c.m - 1, c.d); };
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "Rabi II – Jumada I 1448": the Hijri months a Gregorian month spans. */
export function hijriSpan(y: number, m: number) {
  const days = new Date(y, m, 0).getDate();
  const a = toHijri({ y, m, d: 1 }), b = toHijri({ y, m, d: days });
  const A = HIJRI_MONTHS_SHORT[a.m - 1], B = HIJRI_MONTHS_SHORT[b.m - 1];
  if (a.m === b.m && a.y === b.y) return `${A} ${a.y}`;
  return a.y === b.y ? `${A} – ${B} ${a.y}` : `${A} ${a.y} – ${B} ${b.y}`;
}

/** What a day carries beyond its dates: words for its label, marks drawn under it, and a ground when it is busy. */
export type DayMarks = { label?: string; marks?: React.ReactNode; busy?: boolean };
