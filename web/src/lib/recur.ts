/* Recurrence, kept to the shapes a household actually has: something on a day
   of the month (rent, fees, an EMI) or a day of a particular month (insurance,
   a subscription). Both are written as genuine RFC 5545 rules —
   FREQ=MONTHLY;BYMONTHDAY=5 — so the column means what it says; this file
   parses only the subset it writes, and says so rather than pretending to
   implement the spec.

   Days are capped at 28. The 31st silently becomes the 28th for four months of
   the year, and a rent reminder that moves is worse than none. */

export type Rule =
  | { freq: 'MONTHLY'; day: number }
  | { freq: 'YEARLY'; day: number; month: number };

export const MAX_DAY = 28;

export function buildRule(r: Rule): string {
  return r.freq === 'MONTHLY'
    ? `FREQ=MONTHLY;BYMONTHDAY=${r.day}`
    : `FREQ=YEARLY;BYMONTH=${r.month};BYMONTHDAY=${r.day}`;
}

export function parseRule(rule: string): Rule | null {
  const parts = Object.fromEntries(
    rule.split(';').map((p) => p.split('=')).filter((p) => p.length === 2),
  ) as Record<string, string>;
  const day = Number(parts.BYMONTHDAY);
  if (!Number.isInteger(day) || day < 1 || day > MAX_DAY) return null;
  if (parts.FREQ === 'MONTHLY') return { freq: 'MONTHLY', day };
  if (parts.FREQ === 'YEARLY') {
    const month = Number(parts.BYMONTH);
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return { freq: 'YEARLY', day, month };
  }
  return null;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The next `count` dates on or after `from`, as YYYY-MM-DD. */
export function nextDates(rule: string, from: Date, count = 3): string[] {
  const r = parseRule(rule);
  if (!r) return [];
  const out: string[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

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

const ORDINAL = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th';
  return `${n}${s}`;
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

export function describeRule(rule: string): string {
  const r = parseRule(rule);
  if (!r) return 'on no schedule';
  return r.freq === 'MONTHLY'
    ? `the ${ORDINAL(r.day)} of every month`
    : `the ${ORDINAL(r.day)} of ${MONTHS[r.month - 1]}, every year`;
}

/* Which dues are outstanding, worked out from the rules rather than from rows
   somebody had to create in advance.

   A due is outstanding if the rule puts it on or before the horizon and there
   is no occurrence recorded for that date. Dates already gone are included on
   purpose — a rent payment missed three weeks ago is exactly the thing that
   should still be shouting. */
export type Schedulish = {
  id: string; rrule: string | null; settled: string[];
  /** When the schedule started existing. Dues before it are not missed. */
  since?: string | null;
};
export type Due = { scheduleId: string; dueOn: string; daysAway: number };

export function outstandingDues<T extends Schedulish>(
  schedules: T[], from: Date, horizonDays = 14, lookBackDays = 60,
): Due[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const back = new Date(today); back.setDate(back.getDate() - lookBackDays);
  const out: Due[] = [];

  for (const s of schedules) {
    if (!s.rrule) continue;
    const done = new Set(s.settled ?? []);
    const since = s.since ?? null;
    // Start far enough back to catch anything missed, then walk forward.
    for (const d of nextDates(s.rrule, back, 24)) {
      const when = new Date(d);
      if (when > addDays(today, horizonDays)) break;
      if (done.has(d)) continue;
      // Nothing is owed for a date the schedule did not yet exist on.
      if (since && d < since) continue;
      out.push({
        scheduleId: s.id,
        dueOn: d,
        daysAway: Math.round((when.getTime() - today.getTime()) / 86400000),
      });
    }
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

/** The next date that has not already been settled. After paying this month,
 *  "next" should say next month — not repeat today back at you. */
export function nextUnsettled(rule: string | null, settled: string[], from: Date): string | null {
  if (!rule) return null;
  const done = new Set(settled ?? []);
  return nextDates(rule, from, 14).find((d) => !done.has(d)) ?? null;
}
