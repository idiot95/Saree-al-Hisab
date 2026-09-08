'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import Sheet from '../Sheet';
import DueRow from './DueRow';
import { useMoney } from '@/app/currency';
import { datesInMonth, describeRule, type Calendar as Cal } from '@/lib/recur';
import { formatHijri, toHijri, HIJRI_MONTHS_SHORT } from '@/lib/hijri';

/* The month as a grid, with each day carrying a dot for everything that
   falls on it, and a drawer for the day you tap. Every date is worked out
   from the rules here, on the phone — the same code the server uses for what
   is due — so paging a year ahead costs nothing and asks the server nothing.
   Each English day also wears its Hijri day, because in this house the 1st
   of Ramadaan is a date people plan around and the 17th of February is not. */

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
const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Calendar({ schedules, canWrite, today }: {
  schedules: CalSchedule[]; canWrite: boolean; today: string;
}) {
  const { format } = useMoney();
  const [{ y, m }, setYm] = useState(() => { const c = civil(today); return { y: c.y, m: c.m }; });
  const [sel, setSel] = useState<string | null>(null);
  const close = useCallback(() => setSel(null), []);

  const key = `${y}-${pad(m)}-`;
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first

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

  const hijriSpan = (() => {
    const a = toHijri({ y, m, d: 1 }), b = toHijri({ y, m, d: days });
    const A = `${HIJRI_MONTHS_SHORT[a.m - 1]}`, B = `${HIJRI_MONTHS_SHORT[b.m - 1]}`;
    if (a.m === b.m && a.y === b.y) return `${A} ${a.y}`;
    return a.y === b.y ? `${A} – ${B} ${a.y}` : `${A} ${a.y} – ${B} ${b.y}`;
  })();

  const isNow = today.startsWith(key);
  const step = (n: number) => {
    const x = new Date(y, m - 1 + n, 1);
    setYm({ y: x.getFullYear(), m: x.getMonth() + 1 });
  };
  const selected = sel ? byDay.get(sel) ?? [] : [];
  const selCivil = sel ? civil(sel) : null;

  return (
    <section className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18,
      padding: '12px var(--pad) 12px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" style={nav}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{MONTHS[m - 1]} {y}</span>
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{hijriSpan}</span>
        </div>
        {!isNow && (
          <button type="button" onClick={() => { const c = civil(today); setYm({ y: c.y, m: c.m }); }}
            style={{ ...nav, width: 'auto', padding: '0 10px', fontSize: 'var(--step--2)', fontWeight: 600 }}>
            Today
          </button>
        )}
        <button type="button" onClick={() => step(1)} aria-label="Next month" style={nav}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div role="grid" aria-label={`${MONTHS[m - 1]} ${y}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DOW.map((d) => (
          <span key={d} role="columnheader" style={{
            textAlign: 'center', fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)',
            letterSpacing: '.02em', paddingBottom: 2,
          }}>{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const iso = `${key}${pad(d)}`;
          const items = byDay.get(iso) ?? [];
          const h = toHijri({ y, m, d });
          const isToday = iso === today;
          const label = `${d} ${MONTHS[m - 1]}, ${formatHijri(h, true)}${items.length ? `, ${items.length} scheduled` : ''}`;
          return (
            <button key={iso} type="button" role="gridcell" aria-label={label} onClick={() => setSel(iso)} style={{
              minHeight: 54, borderRadius: 10, padding: '5px 0 4px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: items.length ? 'var(--c-sunk)' : 'transparent',
              boxShadow: isToday ? 'inset 0 0 0 2px var(--c-seagrass)' : undefined,
              color: 'var(--c-ink)',
            }}>
              <span className="t" style={{ fontSize: 'var(--step-0)', lineHeight: 1, fontWeight: isToday ? 700 : 500 }}>{d}</span>
              <span style={{ fontSize: '0.62rem', lineHeight: 1, color: h.d === 1 ? 'var(--c-teal)' : 'var(--c-meta)', fontWeight: h.d === 1 ? 700 : 500 }}>
                {h.d === 1 ? HIJRI_MONTHS_SHORT[h.m - 1] : h.d}
              </span>
              <span style={{ display: 'flex', gap: 3, minHeight: 6, alignItems: 'center' }}>
                {items.slice(0, 3).map((it, j) => <Dot key={j} status={it.status} kind={it.s.kind} />)}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: '2px 0 0', fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        <Key status="coming" kind="expense">goes out</Key>
        <Key status="coming" kind="income">comes in</Key>
        <Key status="overdue" kind="expense">overdue</Key>
        <Key status="paid" kind="expense">done</Key>
        <span style={{ flexBasis: '100%' }}>Hijri days begin at maghrib the evening before; the grid shows the daytime date.</span>
      </p>

      <Sheet open={sel !== null} onClose={close} label={sel ? `Scheduled on ${sel}` : 'Scheduled'}>
        {selCivil && sel && (
          <>
            <header style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0 8px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>
                {DAYS[new Date(selCivil.y, selCivil.m - 1, selCivil.d).getDay()]} {selCivil.d} {MONTHS[selCivil.m - 1]}
              </h3>
              <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                {formatHijri(toHijri(selCivil))}{sel === today ? ' · today' : ''}
              </span>
            </header>

            {selected.length === 0 ? (
              <p style={{ margin: '0 0 12px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
                Nothing is scheduled for this day.
              </p>
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
                <div key={`${it.s.id}:${it.dueOn}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 66, padding: '10px 0',
                  borderBottom: '1px solid var(--c-rule)',
                }}>
                  <span style={{
                    width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: settled ? 'var(--c-sunk)' : 'var(--c-warn-tint)',
                    color: settled ? 'var(--c-meta)' : 'var(--c-warn)',
                  }}>
                    <Icon name={it.s.icon ?? 'autodebit'} size={19} strokeWidth={1.9} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{it.s.name}</span>
                    <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                      {cap(describeRule(it.s.rule, it.s.cal))}
                      {it.movedFrom && ` · moved from the ${civil(it.movedFrom).d}${suffix(civil(it.movedFrom).d)}`}
                    </span>
                    <span style={{ fontSize: 'var(--step--1)', display: 'flex', alignItems: 'center', gap: 5,
                      color: it.status === 'paid' ? 'var(--c-in)' : it.status === 'overdue' ? 'var(--c-danger)' : 'var(--c-meta)' }}>
                      <Icon name={it.status === 'paid' ? 'check' : it.status === 'skipped' ? 'skip' : 'autodebit'} size={14} strokeWidth={2.2} />
                      {it.status === 'paid' ? (income ? 'Came in' : 'Paid') : it.status === 'skipped' ? 'Skipped'
                        : it.status === 'overdue' ? 'Overdue' : it.status === 'today' ? 'Due today' : 'Coming'}
                      {it.status === 'paid' && it.txn && (
                        <Link href={`/entries/${it.txn}`} transitionTypes={['nav-forward']} style={{ color: 'var(--c-teal)', fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
                          See the entry
                        </Link>
                      )}
                    </span>
                  </span>
                  <span className="t" style={{ fontSize: 'var(--step-1)', color: income ? 'var(--c-in)' : 'var(--c-out)', opacity: settled ? 0.7 : 1 }}>
                    {income ? '+' : ''}{format(it.s.amount)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </Sheet>
    </section>
  );
}

function statusOf(s: 'pending' | 'paid' | 'skipped' | undefined, on: string, today: string): Status {
  if (s === 'paid') return 'paid';
  if (s === 'skipped') return 'skipped';
  return on < today ? 'overdue' : on === today ? 'today' : 'coming';
}

/* One mark per thing on the day. Out and in in the ledger's two colours; a
   settled one fades; an overdue one is a ring — hollow, still open. */
function Dot({ status, kind }: { status: Status; kind: 'expense' | 'income' }) {
  const settled = status === 'paid' || status === 'skipped';
  const colour = status === 'overdue' ? 'var(--c-danger)'
    : settled ? 'var(--c-meta)' : kind === 'income' ? 'var(--c-in)' : 'var(--c-out)';
  return (
    <span aria-hidden style={{
      width: 7, height: 7, borderRadius: 999, boxSizing: 'border-box',
      background: status === 'overdue' ? 'transparent' : colour,
      border: status === 'overdue' ? `2px solid ${colour}` : undefined,
      opacity: settled ? 0.45 : 1,
    }} />
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function suffix(n: number) {
  return ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th';
}

function Key({ status, kind, children }: { status: Status; kind: 'expense' | 'income'; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Dot status={status} kind={kind} />
      {children}
    </span>
  );
}

const nav: React.CSSProperties = {
  width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--c-ink)',
};
