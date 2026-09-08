/* Recurrence, kept to the shapes a household actually has: something on a day
   of the month (rent, fees, an EMI) or a day of a particular month (insurance,
   a subscription). Both are written as genuine RFC 5545 rules —
   FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270205 — so the column means what it
   says; this file parses only the subset it writes, and says so rather than
   pretending to implement the spec.

   The same grammar is used for a rule on the Hijri calendar, kept in its own
   column (schedule.hijri_rule) so nobody can mistake one for the other. There
   the month and day are Misri — FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1 is the 1st
   of Ramadaan — and every date this file hands back is still a Gregorian
   YYYY-MM-DD, because that is what the ledger and the phone run on. UNTIL is
   a Gregorian day in both, for the same reason: it is compared against the
   ledger's dates, and there must be exactly one way to read it.

   An end is always stored as a date. "Five times" is turned into the fifth
   date when the rule is written, so the rule alone says when it stops and no
   count needs keeping. Days are capped at 28 (Gregorian) and 29 (Hijri) for
   the monthly kind: the 31st silently becomes the 28th for four months of the
   year, and a rent reminder that moves is worse than none. */

import { fromHijri, toHijri, hijriDaysInMonth, HIJRI_MONTHS_SHORT, civilToJdn } from './hijri/index.ts';

export type Calendar = 'gregorian' | 'hijri';

export type Rule =
  | { freq: 'MONTHLY'; day: number; until?: string }
  | { freq: 'YEARLY'; day: number; month: number; until?: string };

export const MAX_DAY = 28;
export const MAX_HIJRI_DAY = 29;

/** The most a day-of-month can be for a rule that must fall in every month it names. */
export function maxDay(cal: Calendar, freq: 'MONTHLY' | 'YEARLY', month?: number): number {
  if (cal === 'gregorian') return MAX_DAY;
  if (freq === 'MONTHLY' || !month) return MAX_HIJRI_DAY;
  // Odd Misri months always have 30 days; Zilhaj only in a Kabisa year.
  return month % 2 === 1 ? 30 : MAX_HIJRI_DAY;
}

export function buildRule(r: Rule): string {
  const base = r.freq === 'MONTHLY'
    ? `FREQ=MONTHLY;BYMONTHDAY=${r.day}`
    : `FREQ=YEARLY;BYMONTH=${r.month};BYMONTHDAY=${r.day}`;
  return r.until ? `${base};UNTIL=${r.until.replaceAll('-', '')}` : base;
}

const isCivil = (y: number, m: number, d: number) =>
  Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d) && y >= 1970 && y <= 2999
  && m >= 1 && m <= 12 && d >= 1 && d <= 31
  && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;

/** RFC 5545's DATE form, 20270205, to the ledger's 2027-02-05; null if it is not a day. */
function parseUntil(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (!/^\d{8}$/.test(v)) return null;
  const y = Number(v.slice(0, 4)), m = Number(v.slice(4, 6)), d = Number(v.slice(6, 8));
  return isCivil(y, m, d) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null;
}

export function parseRule(rule: string, cal: Calendar = 'gregorian'): Rule | null {
  const parts = Object.fromEntries(
    rule.split(';').map((p) => p.split('=')).filter((p) => p.length === 2),
  ) as Record<string, string>;
  const day = Number(parts.BYMONTHDAY);
  if (!Number.isInteger(day) || day < 1) return null;
  const until = parseUntil(parts.UNTIL);
  if (until === null) return null;
  const tail = until ? { until } : {};
  if (parts.FREQ === 'MONTHLY') {
    return day > maxDay(cal, 'MONTHLY') ? null : { freq: 'MONTHLY', day, ...tail };
  }
  if (parts.FREQ === 'YEARLY') {
    const month = Number(parts.BYMONTH);
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return day > maxDay(cal, 'YEARLY', month) ? null : { freq: 'YEARLY', day, month, ...tail };
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoCivil = (c: { y: number; m: number; d: number }) => `${c.y}-${pad(c.m)}-${pad(c.d)}`;

/** The next `count` dates on or after `from`, as YYYY-MM-DD — fewer if the
 *  rule ends first, none once it has. */
export function nextDates(rule: string, from: Date, count = 3, cal: Calendar = 'gregorian'): string[] {
  const r = parseRule(rule, cal);
  if (!r) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const all = cal === 'hijri' ? hijriDates(r, start, count) : gregorianDates(r, start, count);
  return r.until ? all.filter((d) => d <= r.until!) : all;
}

function gregorianDates(r: Rule, start: Date, count: number): string[] {
  const out: string[] = [];
  if (r.freq === 'MONTHLY') {
    let y = start.getFullYear(), m = start.getMonth();
    // If this month's day has already gone, begin with next month.
    if (start.getDate() > r.day) { m += 1; if (m > 11) { m = 0; y += 1; } }
    for (let i = 0; i < count; i++) {
      out.push(iso(new Date(y, m, r.day)));
      m += 1; if (m > 11) { m = 0; y += 1; }
    }
    return out;
  }
  let y = start.getFullYear();
  const thisYear = new Date(y, r.month - 1, r.day);
  if (thisYear < start) y += 1;
  for (let i = 0; i < count; i++) out.push(iso(new Date(y + i, r.month - 1, r.day)));
  return out;
}

/* The same walk in Misri months and years, with each date brought back to
   Gregorian at the end. A Hijri "monthly" comes round every 29 or 30 days, so
   twelve of them are eleven days short of a Gregorian year — which is the
   point of asking for it. */
function hijriDates(r: Rule, start: Date, count: number): string[] {
  const out: string[] = [];
  const h = toHijri({ y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() });
  if (r.freq === 'MONTHLY') {
    let y = h.y, m = h.m;
    if (h.d > r.day) { m += 1; if (m > 12) { m = 1; y += 1; } }
    for (let i = 0; i < count; i++) {
      out.push(isoCivil(fromHijri({ y, m, d: Math.min(r.day, hijriDaysInMonth(y, m)) })));
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }
  let y = h.y;
  const startJdn = civilToJdn({ y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() });
  const dayIn = (year: number) => Math.min(r.day, hijriDaysInMonth(year, r.month));
  if (civilToJdn(fromHijri({ y, m: r.month, d: dayIn(y) })) < startJdn) y += 1;
  for (let i = 0; i < count; i++) {
    out.push(isoCivil(fromHijri({ y: y + i, m: r.month, d: dayIn(y + i) })));
  }
  return out;
}

const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th';
  return `${n}${s}`;
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 2027-02-05 → "5 Feb 2027", with no locale in the way. */
export const friendlyDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};

/* Dates as a person says them. The ledger keeps YYYY-MM-DD; a screen says
   "Today", "Sat 12 Sep", or "Sat 12 Sep 2027" when the year is not this
   one. All of it in UTC arithmetic on the civil date, so a phone in any
   time zone gets the same words for the same day. */
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** The civil date n days on (or back, for a negative n). */
export function shiftDay(iso: string, n: number): string {
  return new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
}

/** Whole days from `today` to `iso`: tomorrow is 1, yesterday −1. */
export const daysBetween = (today: string, iso: string) => Math.round((utc(iso) - utc(today)) / 86400000);

/** "Sat 12 Sep", the year only when it is not today's; "Today", "Tomorrow"
 *  and "Yesterday" for those, when today is known. */
export function friendlyDay(iso: string, today?: string): string {
  if (today) {
    const gap = daysBetween(today, iso);
    if (gap === 0) return 'Today';
    if (gap === 1) return 'Tomorrow';
    if (gap === -1) return 'Yesterday';
  }
  const [y, m, d] = iso.split('-').map(Number);
  const dow = DAY[new Date(utc(iso)).getUTCDay()];
  const year = today && today.slice(0, 4) === iso.slice(0, 4) ? '' : ` ${y}`;
  return `${dow} ${d} ${MON[m - 1]}${year}`;
}

/** "today", "tomorrow", "in 4 days", "3 days ago" — the distance in words. */
export function inWords(today: string, iso: string): string {
  const gap = daysBetween(today, iso);
  if (gap === 0) return 'today';
  if (gap === 1) return 'tomorrow';
  if (gap === -1) return 'yesterday';
  return gap > 0 ? `in ${gap} days` : `${-gap} days ago`;
}

/** "every month on the 5th" · "every year on 1 Ramadaan" · "…, until 5 Jan
 *  2027". Starts lower-case so it can end a sentence; a row that leads with
 *  it capitalises. */
export function describeRule(rule: string, cal: Calendar = 'gregorian'): string {
  const r = parseRule(rule, cal);
  if (!r) return 'on no schedule';
  const when = r.freq === 'MONTHLY'
    ? `every ${cal === 'hijri' ? 'Hijri month' : 'month'} on the ${ORDINAL(r.day)}`
    : `every year on ${r.day} ${(cal === 'hijri' ? HIJRI_MONTHS_SHORT : MON)[r.month - 1]}`;
  return r.until ? `${when}, until ${friendlyDate(r.until)}` : when;
}

/* Which dues are outstanding, worked out from the rules rather than from rows
   somebody had to create in advance.

   A due is outstanding if the rule puts it on or before the horizon and there
   is no occurrence recorded for that date. Dates already gone are included on
   purpose — a rent payment missed three weeks ago is exactly the thing that
   should still be shouting. */
export type Schedulish = {
  id: string; rrule: string | null; hijri_rule?: string | null; settled: string[];
  /** When the schedule started existing. Dues before it are not missed. */
  since?: string | null;
  /** Rule dates moved to another day and not yet dealt with. */
  moved?: { from: string; to: string }[] | null;
};
/** One thing owed. `dueOn` is the rule's date and the occurrence's identity;
 *  `on` is the day it is actually expected — the same, unless it was moved. */
export type Due = {
  scheduleId: string; dueOn: string; on: string; daysAway: number; movedFrom?: string;
};

/** Whichever calendar a schedule is written on. The table's CHECK keeps one
 *  of the two present; if both ever were, the Gregorian one wins here. */
export function ruleOf(s: Pick<Schedulish, 'rrule' | 'hijri_rule'>): { rule: string; cal: Calendar } | null {
  if (s.rrule) return { rule: s.rrule, cal: 'gregorian' };
  if (s.hijri_rule) return { rule: s.hijri_rule, cal: 'hijri' };
  return null;
}

/** Ended: the rule has an UNTIL and it is before today. */
export function isFinished(s: Pick<Schedulish, 'rrule' | 'hijri_rule'>, today: Date): boolean {
  const r = ruleOf(s);
  const parsed = r && parseRule(r.rule, r.cal);
  return !!parsed?.until && parsed.until < iso(today);
}

export function outstandingDues<T extends Schedulish>(
  schedules: T[], from: Date, horizonDays = 14, lookBackDays = 60,
): Due[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const back = new Date(today); back.setDate(back.getDate() - lookBackDays);
  const out: Due[] = [];

  const horizon = addDays(today, horizonDays);

  for (const s of schedules) {
    const r = ruleOf(s);
    if (!r) continue;
    const done = new Set(s.settled ?? []);
    const moves = new Map((s.moved ?? []).map((m) => [m.from, m.to]));
    const since = s.since ?? null;
    // Start far enough back to catch anything missed, then walk forward.
    for (const d of nextDates(r.rule, back, 24, r.cal)) {
      if (new Date(d) > horizon) break;
      if (done.has(d)) continue;
      // Nothing is owed for a date the schedule did not yet exist on.
      if (since && d < since) continue;
      // A moved due is owed on the day it was moved to, not the rule's day.
      const on = moves.get(d) ?? d;
      const when = new Date(on);
      if (when > horizon) continue;
      out.push({
        scheduleId: s.id,
        dueOn: d,
        on,
        daysAway: Math.round((when.getTime() - today.getTime()) / 86400000),
        ...(on !== d ? { movedFrom: d } : {}),
      });
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on));
}

function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

/** The next date that has not already been settled. After paying this month,
 *  "next" should say next month — not repeat today back at you. Null once
 *  the rule has run out. */
export function nextUnsettled(
  s: Pick<Schedulish, 'rrule' | 'hijri_rule' | 'moved'>, settled: string[], from: Date,
): string | null {
  const r = ruleOf(s);
  if (!r) return null;
  const done = new Set(settled ?? []);
  const moves = new Map((s.moved ?? []).map((m) => [m.from, m.to]));
  const d = nextDates(r.rule, from, 14, r.cal).find((x) => !done.has(x));
  return d ? (moves.get(d) ?? d) : null;
}

/** The rule's dates that fall in a calendar month (Gregorian y, m 1–12).
 *  A Hijri monthly rule can land twice in one English month. */
export function datesInMonth(rule: string, cal: Calendar, y: number, m: number): string[] {
  const key = `${y}-${pad(m)}-`;
  return nextDates(rule, new Date(y, m - 1, 1), 3, cal).filter((d) => d.startsWith(key));
}

/** The same rule, with its day — and for a yearly rule its month — taken
 *  from `to`, read on the rule's own calendar. "Make the 10th the day from
 *  now on." Null when that day is past the cap: the 31st cannot be every
 *  month's day, so the answer is to move just the one. UNTIL is kept. */
export function rewriteRuleTo(rule: string, cal: Calendar, to: string): string | null {
  const r = parseRule(rule, cal);
  if (!r) return null;
  const [gy, gm, gd] = to.split('-').map(Number);
  if (!isCivil(gy, gm, gd)) return null;
  const { m, d } = cal === 'hijri' ? toHijri({ y: gy, m: gm, d: gd }) : { m: gm, d: gd };
  const month = r.freq === 'YEARLY' ? m : undefined;
  if (d > maxDay(cal, r.freq, month)) return null;
  const next = r.freq === 'YEARLY'
    ? buildRule({ freq: 'YEARLY', day: d, month: m, until: r.until })
    : buildRule({ freq: 'MONTHLY', day: d, until: r.until });
  return parseRule(next, cal) ? next : null;
}
