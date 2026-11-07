'use client';

import Link from '@/app/NavLink';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '../Icon';
import BottomDrawer from '../BottomDrawer';
import HijriCalendar, { opensCalendar } from '../LazyCalendar';
import { MONTHS, civil, hijriSpan, type DayMarks } from '../calendar-dates';
import { cn } from '@/lib/utils';
import { haptic } from '../haptics';
import DueRow from './DueRow';
import { rowRule, rulePad } from '../form-bits';
import { useMoney } from '@/app/currency';
import { datesInMonth, describeRule, type Calendar as Cal } from '@/lib/recur';
import { formatHijri, toHijri } from '@/lib/hijri';

/* The month as a grid, with each day carrying a dot for everything that
   falls on it, and a drawer for the day you tap. Every date is worked out
   from the rules here, on the phone — the same code the server uses for what
   is due — so paging a year ahead costs nothing and asks the server nothing.
   Each English day also wears its Hijri day, because in this house the 1st
   of Ramadaan is a date people plan around and the 17th of February is not.

   The grid is folded away by default — one line says what the month holds,
   and a tap on it opens the days. Whether it was left open is remembered on
   the phone. Open, a swipe across the grid pages a month, and the arrows
   beside the month name are the same move for a thumb that prefers to tap. */

const OPEN_KEY = 'calendar-open';
const onStorage = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};
const storedOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };

export type CalSchedule = {
  id: string; name: string; kind: 'expense' | 'income'; amount: number;
  category: string | null; icon: string | null; tint: string | null;
  rule: string; cal: Cal; since: string;
  occurrences: { on: string; status: 'pending' | 'paid' | 'skipped'; to: string | null; txn: string | null }[];
};

type Status = 'paid' | 'skipped' | 'overdue' | 'today' | 'coming';
type Item = {
  s: CalSchedule; dueOn: string; on: string; status: Status; txn: string | null; movedFrom?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Calendar({ schedules, canWrite, today }: {
  schedules: CalSchedule[]; canWrite: boolean; today: string;
}) {
  const { format } = useMoney();
  const [{ y, m }, setYm] = useState(() => { const c = civil(today); return { y: c.y, m: c.m }; });
  const [sel, setSel] = useState<string | null>(null);
  const close = useCallback(() => setSel(null), []);
  // Folded on the server and on first paint; the phone's own choice after.
  const remembered = useSyncExternalStore(onStorage, storedOpen, () => false);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? remembered;
  const toggle = () => {
    haptic('tap');
    try { localStorage.setItem(OPEN_KEY, open ? '0' : '1'); } catch { /* storage is optional */ }
    setChosen(!open);
  };
  // A swipe across the grid: sideways and far enough pages the month, and
  // anything else is left to the page to scroll.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);   // a page-turn's finger lifted on a day; that is not a tap on it

  const key = `${y}-${pad(m)}-`;

  /* Everything that lands in this month, keyed by the day it lands on. A
     rule's date that was moved shows where it went; one moved in from the
     month before shows here too, with where it came from. */
  const byDay = useMemo(() => {
    const out = new Map<string, Item[]>();
    const put = (d: string, it: Item) => out.set(d, [...(out.get(d) ?? []), it]);
    for (const s of schedules) {
      const occ = new Map(s.occurrences.map((o) => [o.on, o]));
      const dates = datesInMonth(s.rule, s.cal, y, m);
      for (const d of dates) {
        const o = occ.get(d);
        // Never owed, never happened: a date before the schedule existed.
        if (!o && d < s.since) continue;
        const on = o?.to ?? d;
        if (!on.startsWith(key)) continue;
        put(on, { s, dueOn: d, on, txn: o?.txn ?? null, status: statusOf(o?.status, on, today),
                  ...(on !== d ? { movedFrom: d } : {}) });
      }
      for (const o of s.occurrences) {
        if (!o.to || !o.to.startsWith(key) || o.on.startsWith(key)) continue;
        put(o.to, { s, dueOn: o.on, on: o.to, txn: o.txn, status: statusOf(o.status, o.to, today), movedFrom: o.on });
      }
    }
    for (const list of out.values()) list.sort((a, b) => a.s.name.localeCompare(b.s.name));
    return out;
  }, [schedules, y, m, key, today]);

  const isNow = today.startsWith(key);
  const step = (n: number) => {
    const x = new Date(y, m - 1 + n, 1);
    setYm({ y: x.getFullYear(), m: x.getMonth() + 1 });
  };
  const selected = sel ? byDay.get(sel) ?? [] : [];
  const selCivil = sel ? civil(sel) : null;

  /* The month in one line for the folded header: how many things land in
     it, and what they add up to, out and in. Settled ones still count — the
     line describes the month, not what is left of it. */
  const all = useMemo(() => Array.from(byDay.values()).flat(), [byDay]);
  const outSum = all.filter((it) => it.s.kind === 'expense').reduce((n, it) => n + it.s.amount, 0);
  const inSum = all.filter((it) => it.s.kind === 'income').reduce((n, it) => n + it.s.amount, 0);
  const overdue = all.filter((it) => it.status === 'overdue').length;
  const summary = all.length === 0 ? 'Nothing scheduled'
    : [`${all.length} scheduled`, outSum > 0 ? `${format(outSum)} out` : null,
       inSum > 0 ? `${format(inSum)} in` : null].filter(Boolean).join(' · ');

  const marksFor = useCallback((iso: string): DayMarks | undefined => {
    const items = byDay.get(iso);
    if (!items?.length) return { marks: null };
    return {
      busy: true,
      label: `${items.length} scheduled`,
      marks: items.slice(0, 3).map((it, j) => <Dot key={j} status={it.status} kind={it.s.kind} />),
    };
  }, [byDay]);

  return (
    <section className="mx-[var(--gutter)] flex flex-col gap-2 rounded-[20px] bg-card shadow-card px-[var(--pad)] py-1.5">
      <button type="button" {...opensCalendar} onClick={toggle} aria-expanded={open} aria-controls="cal-grid"
        className="flex min-h-15 w-full items-center gap-3 bg-transparent text-left text-foreground">
        <span className={cn('grid size-10 flex-none place-items-center rounded-full',
          overdue ? 'bg-destructive/12 text-destructive' : 'bg-muted text-primary')}>
          <Icon name="autodebit" size={19} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-headline font-semibold">
            {MONTHS[m - 1]} {y}
            <span className="font-normal text-muted-foreground"> · {hijriSpan(y, m)}</span>
          </span>
          <span className={cn('text-body', overdue ? 'text-destructive' : 'text-muted-foreground')}>
            {overdue ? `${overdue} overdue · ` : ''}{summary}
          </span>
        </span>
        <span aria-hidden className={cn('grid size-7 flex-none place-items-center rounded-full bg-muted text-muted-foreground transition-transform',
          open && 'rotate-180')}>
          <Icon name="expand_more" size={18} />
        </span>
      </button>

      <div id="cal-grid" hidden={!open} className={cn('flex-col gap-2 pb-1.5', open && 'flex')}>
        {/* A swipe across the grid pages the month; anything else is left to the page to scroll. */}
        <div className="touch-pan-y"
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const from = swipe.current; swipe.current = null;
            if (!from) return;
            const dx = e.clientX - from.x, dy = e.clientY - from.y;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              swiped.current = true; haptic('tap'); step(dx < 0 ? 1 : -1);
              setTimeout(() => { swiped.current = false; }, 400);
            }
          }}
          onPointerCancel={() => { swipe.current = null; }}
          onClickCapture={(e) => { if (swiped.current) { e.stopPropagation(); e.preventDefault(); } }}>
          {/* Drawn only while unfolded, so a folded month never loads the grid (LazyCalendar.tsx). */}
          {open && <HijriCalendar month={new Date(y, m - 1, 1)} onMonthChange={(d) => setYm({ y: d.getFullYear(), m: d.getMonth() + 1 })}
            today={today} onPick={setSel} marksFor={marksFor}
            className="-mx-[calc(var(--pad)-2px)] w-[calc(100%+2*var(--pad)-4px)]" />}
        </div>

        {!isNow && (
          <button type="button" onClick={() => { const c = civil(today); setYm({ y: c.y, m: c.m }); }}
            className="mx-auto flex min-h-11 items-center rounded-full px-3 text-body font-semibold text-primary">
            Back to today
          </button>
        )}

        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-footnote leading-snug text-muted-foreground">
          <Key status="coming" kind="expense">goes out</Key>
          <Key status="coming" kind="income">comes in</Key>
          <Key status="overdue" kind="expense">overdue</Key>
          <Key status="paid" kind="expense">done</Key>
          <span className="basis-full">Hijri days begin at maghrib the evening before; the grid shows the daytime date. Swipe across the days for another month.</span>
        </p>
      </div>

      <BottomDrawer open={sel !== null} onClose={close} label={sel ? `Scheduled on ${sel}` : 'Scheduled'}>
        {selCivil && sel && (
          <>
            <header className="flex flex-col gap-0.5 pt-0.5 pb-2">
              <h3 className="text-headline font-semibold">
                {DAYS[new Date(selCivil.y, selCivil.m - 1, selCivil.d).getDay()]} {selCivil.d} {MONTHS[selCivil.m - 1]}
              </h3>
              <span className="text-subhead text-muted-foreground">
                {formatHijri(toHijri(selCivil))}{sel === today ? ' · today' : ''}
              </span>
            </header>

            {selected.length === 0 ? (
              <p className="mb-3 text-subhead leading-normal text-muted-foreground">Nothing is scheduled for this day.</p>
            ) : selected.map((it) => {
              const daysAway = Math.round((Date.parse(it.on) - Date.parse(today)) / 86400000);
              const settled = it.status === 'paid' || it.status === 'skipped';
              if (!settled && canWrite) {
                return (
                  <DueRow key={`${it.s.id}:${it.dueOn}`} scheduleId={it.s.id} name={it.s.name} kind={it.s.kind}
                    dueOn={it.dueOn} on={it.on} movedFrom={it.movedFrom} daysAway={daysAway}
                    amount={it.s.amount} category={it.s.category} icon={it.s.icon} tint={it.s.tint}
                    rule={it.s.rule} cal={it.s.cal} today={today} canRecord={daysAway <= 14} />
                );
              }
              const income = it.s.kind === 'income';
              return (
                <div key={`${it.s.id}:${it.dueOn}`} className={`relative flex min-h-16 items-center gap-3 py-2.5 ${rowRule} ${rulePad} last:after:hidden`}>
                  <span className={cn('grid size-10 flex-none place-items-center rounded-[12px]',
                    settled ? 'bg-muted text-muted-foreground' : 'bg-attention-soft text-attention-soft-foreground')}>
                    <Icon name={it.s.icon ?? 'autodebit'} size={19} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body font-medium [overflow-wrap:anywhere]">{it.s.name}</span>
                    <span className="text-footnote text-muted-foreground">
                      {cap(describeRule(it.s.rule, it.s.cal))}
                      {it.movedFrom && ` · moved from the ${civil(it.movedFrom).d}${suffix(civil(it.movedFrom).d)}`}
                    </span>
                    <span className={cn('flex flex-wrap items-center gap-1.5 text-body',
                      it.status === 'paid' ? 'text-money-in' : it.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground')}>
                      <Icon name={it.status === 'paid' ? 'check' : it.status === 'skipped' ? 'skip' : 'autodebit'} size={14} />
                      {it.status === 'paid' ? (income ? 'Came in' : 'Paid') : it.status === 'skipped' ? 'Skipped'
                        : it.status === 'overdue' ? 'Overdue' : it.status === 'today' ? 'Due today' : 'Coming'}
                      {it.status === 'paid' && it.txn && (
                        <Link href={`/entries/${it.txn}?from=${encodeURIComponent('/entries?f=upcoming')}`}
                          className="ml-1.5 inline-flex min-h-11 items-center font-semibold text-primary">
                          See the entry
                        </Link>
                      )}
                    </span>
                  </span>
                  <span className={cn('flex-none text-headline font-semibold tabular-nums', income ? 'text-money-in' : 'text-money-out', settled && 'opacity-70')}>
                    {income ? '+' : ''}{format(it.s.amount)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </BottomDrawer>
    </section>
  );
}

function statusOf(s: 'pending' | 'paid' | 'skipped' | undefined, on: string, today: string): Status {
  if (s === 'paid') return 'paid';
  if (s === 'skipped') return 'skipped';
  return on < today ? 'overdue' : on === today ? 'today' : 'coming';
}

/* One mark per thing on the day. Out and in in the ledger's two colours; a settled one fades; an overdue one is a
   ring — hollow, still open — so the shape says it as well as the colour. The day's label carries the count. */
function Dot({ status, kind }: { status: Status; kind: 'expense' | 'income' }) {
  const settled = status === 'paid' || status === 'skipped';
  return (
    <span aria-hidden className={cn('box-border size-[7px] rounded-full',
      status === 'overdue' ? 'border-2 border-destructive bg-transparent'
        : settled ? 'bg-muted-foreground opacity-45' : kind === 'income' ? 'bg-money-in' : 'bg-money-out')} />
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function suffix(n: number) {
  return ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th';
}

function Key({ status, kind, children }: { status: Status; kind: 'expense' | 'income'; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot status={status} kind={kind} />
      {children}
    </span>
  );
}
