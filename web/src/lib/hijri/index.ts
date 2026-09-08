/* The Misri calendar — the tabular Hijri calendar the Dawoodi Bohra
   community keeps, in which every date is arithmetic and known years ahead.
   That is what makes it usable for a schedule at all: a reminder for the
   1st of Ramadaan has to know when that is, and a calendar that waits on a
   sighting cannot say.

   Odd months have 30 days and even months 29, except Zilhaj, which has 30 in
   a Kabisa (leap) year; eleven of every thirty years are Kabisa. The epoch
   is JDN 1948439 — Thursday 15 July 622 in the Julian calendar.

   A port, with integer arithmetic, of @mygulamali/hijri_date 0.0.2
   (MIT, © 2022 Murtaza Gulamali — LICENSE beside this file), which is the
   calendar behind mumineen.org. The port is checked against the original
   over 300 years of days in hijri.test.mjs. One difference is deliberate:
   the original's floating-point cycle division puts the last day of every
   thirtieth year on day 0 of the next; this one does not.

   Nothing here knows about time of day or time zones. A date is a civil
   date, the same triple the ledger's `occurred_on` holds. */

export type Civil = { y: number; m: number; d: number };   // Gregorian, m 1–12
export type Hijri = { y: number; m: number; d: number };   // Misri, m 1–12

const KABISA = new Set([2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29]);

/** Days before the first of each month, month 1 → 0. */
const BEFORE_MONTH = [0, 30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];

/** Days before each year of a 30-year cycle, year 0 of the cycle → 0. */
const BEFORE_YEAR = [
  0, 354, 708, 1063, 1417, 1771, 2126, 2480, 2834, 3189, 3543,
  3898, 4252, 4606, 4961, 5315, 5669, 6024, 6378, 6732, 7087,
  7441, 7796, 8150, 8504, 8859, 9213, 9567, 9922, 10276,
];
const CYCLE = 10631;              // days in thirty years
const EPOCH = 1948084;            // JDN the day before 1 Moharram of year 0

export const isKabisa = (y: number) => KABISA.has(((y % 30) + 30) % 30);

export function hijriDaysInMonth(y: number, m: number): number {
  if (m === 12) return isKabisa(y) ? 30 : 29;
  return m % 2 === 1 ? 30 : 29;
}

export const HIJRI_MONTHS = [
  'Moharram al-Haraam', 'Safar al-Muzaffar', 'Rabi al-Awwal', 'Rabi al-Aakhar',
  'Jumada al-Ula', 'Jumada al-Ukhra', 'Rajab al-Asab', 'Shabaan al-Karim',
  'Ramadaan al-Moazzam', 'Shawwal al-Mukarram', 'Zilqadah al-Haraam', 'Zilhaj al-Haraam',
] as const;

export const HIJRI_MONTHS_SHORT = [
  'Moharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II',
  'Rajab', 'Shabaan', 'Ramadaan', 'Shawwal', 'Zilqadah', 'Zilhaj',
] as const;

/* ── Julian day numbers, the common ground between the two calendars ────── */

/** Proleptic Gregorian → JDN (Fliegel & Van Flandern). */
export function civilToJdn({ y, m, d }: Civil): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function jdnToCivil(jdn: number): Civil {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function hijriToJdn({ y, m, d }: Hijri): number {
  const cycles = Math.floor(y / 30);
  return EPOCH + cycles * CYCLE + BEFORE_YEAR[y - cycles * 30] + BEFORE_MONTH[m - 1] + d;
}

export function jdnToHijri(jdn: number): Hijri {
  let left = jdn - EPOCH;                       // 1 on 1 Moharram of year 0; 355 on 1 Moharram 1
  const cycles = Math.floor((left - 1) / CYCLE); // the last day of a cycle stays in it
  left -= cycles * CYCLE;
  let i = 0;
  while (i < 29 && left > BEFORE_YEAR[i + 1]) i++;
  left -= BEFORE_YEAR[i];
  const y = cycles * 30 + i;
  let m = 0;
  while (m < 11 && left > BEFORE_MONTH[m + 1]) m++;
  return { y, m: m + 1, d: left - BEFORE_MONTH[m] };
}

/* ── the two conversions everything else uses ───────────────────────────── */

export const toHijri = (c: Civil): Hijri => jdnToHijri(civilToJdn(c));
export const fromHijri = (h: Hijri): Civil => jdnToCivil(hijriToJdn(h));

/** "21 Rabi al-Awwal 1448" — the long month name, as the community writes it. */
export function formatHijri(h: Hijri, short = false): string {
  return `${h.d} ${(short ? HIJRI_MONTHS_SHORT : HIJRI_MONTHS)[h.m - 1]} ${h.y}`;
}
