'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Chip } from '../Icon';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { useMoney } from '@/app/currency';
import { removeEntry, restoreEntry } from './actions';
import { startPending } from '../pending';

export type Row = {
  id: string; kind: string; amount: string; merchant: string | null;
  category: string | null; method: string | null; account: string;
  counter_account: string | null; icon: string | null; tint: string | null; is_shared: boolean;
  /* A cost laid out for several people on a tab is several loans underneath
     and one line here. `rows` says how many, `people` who it went to. Such a
     line opens its tab rather than a single row of it, and is not swipeable:
     editing one loan of three would leave the payment adding up to nothing. */
  people: string | null; to_person: boolean; from_person: boolean;
  settles: boolean; counts_as_spend: boolean; book_id: string | null;
};

const MOVES = new Set(['transfer', 'card_payment']);
const INCOMING = new Set(['income', 'claim_receipt', 'refund', 'adjust_in']);

/* The month's entries, a card per day. Tap a row to open it; swipe it left
   for Edit and Delete, and all the way across to delete in one move. Delete
   is soft in the database and undoable on the screen, so it can afford to be
   one gesture with no dialog in front of it. */
/* Activity can narrow the month by what kind of money it was, and find a line by any word on it. Both run over
   the month already on screen, so they answer as you type. */
const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'spending', label: 'Spending', test: (e: Row) => e.kind === 'expense' },
  { key: 'income', label: 'Income', test: (e: Row) => INCOMING.has(e.kind) },
  { key: 'moves', label: 'Moves', test: (e: Row) => MOVES.has(e.kind) },
  { key: 'shared', label: 'Shared', test: (e: Row) => e.is_shared },
] as const;

export default function EntryList({ days, canEdit, tools = false, flat = false }: {
  days: { on: string; label: string; rows: Row[] }[]; canEdit: boolean;
  /** Show search and the filter chips (Activity). */
  tools?: boolean;
  /** One card without day headings (Home's "Today"). */
  flat?: boolean;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return days.map((d) => ({ ...d, rows: d.rows.filter((e) => test(e) && words.every((w) =>
      [e.merchant, e.category, e.method, e.account, e.counter_account, e.people].some((x) => x?.toLowerCase().includes(w)))) }));
  }, [days, q, filter]);
  const { format } = useMoney();
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [snack, setSnack] = useState<SnackState>(null);
  const [, start] = useTransition();
  const closeSnack = useCallback(() => setSnack(null), []);

  const unhide = (id: string) => setGone((g) => { const n = new Set(g); n.delete(id); return n; });

  function del(e: Row) {
    setGone((g) => new Set(g).add(e.id));
    start(async () => {
      const r = await removeEntry(e.id);
      if (!r.ok) { unhide(e.id); setSnack({ text: r.error, tone: 'error' }); return; }
      const what = e.merchant || e.category || (MOVES.has(e.kind) ? 'Transfer' : 'Entry');
      setSnack({
        text: `${what} · ${format(Number(e.amount))} deleted`,
        undo: () => start(async () => {
          const back = await restoreEntry(e.id);
          if (back.ok) unhide(e.id);
          else setSnack({ text: back.error, tone: 'error' });
        }),
      });
    });
  }

  const nothing = shown.every((d) => d.rows.every((e) => gone.has(e.id)));
  return (
    <div className={flat ? '' : 'pt-3'}>
      {tools && (
        <div className="flex flex-col gap-2.5 px-[var(--gutter)] pb-4">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground focus-within:border-ring">
            <IconSearch size={18} aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this month"
              aria-label="Search this month's entries" className="min-w-0 flex-1 bg-transparent py-2 text-foreground outline-none placeholder:text-muted-foreground" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="grid size-8 place-items-center rounded-full bg-muted"><IconX size={15} /></button>}
          </label>
          <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${filter === f.key
                  ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {tools && nothing && (
        <p className="px-[var(--gutter)] py-8 text-center text-muted-foreground">
          {q ? `Nothing this month matches “${q.trim()}”.` : 'Nothing of that kind this month.'}
        </p>
      )}
      {shown.map((d) => {
        const rows = d.rows.filter((e) => !gone.has(e.id));
        if (rows.length === 0) return null;
        return (
          <section key={d.on} className={flat ? '' : 'mb-4'}>
            {!flat && (
              <h2 className="mx-[var(--gutter)] mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</h2>
            )}
            <div className={`${flat ? '' : 'mx-[var(--gutter)]'} overflow-hidden rounded-2xl border border-border bg-card px-[var(--pad)]`}>
              {rows.map((e, i) => (
                <SwipeRow key={e.id} actions={canEdit ? [
                  { label: 'Edit', tone: 'primary', icon: <Pen />,
                    act: () => { startPending(`/entries/${e.id}`); router.push(`/entries/${e.id}`, { transitionTypes: ['nav-forward'] }); } },
                  { label: 'Delete', tone: 'danger', icon: <Bin />, act: () => del(e) },
                ] : []}>
                  <Entry e={e} last={i === rows.length - 1} />
                </SwipeRow>
              ))}
            </div>
          </section>
        );
      })}
      <Snack snack={snack} onClose={closeSnack} />
    </div>
  );
}

function Entry({ e, last }: { e: Row; last: boolean }) {
  const { format } = useMoney();
  const move = MOVES.has(e.kind);
  const incoming = INCOMING.has(e.kind);
  const lent = move && e.to_person;
  const cameBack = (move && e.from_person) || e.settles;
  // A cost carried for somebody else: it left the account and no chart counts it.
  const carried = !move && !e.counts_as_spend;
  return (
    <Link href={`/entries/${e.id}`} transitionTypes={['nav-forward']} draggable={false} style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
      textDecoration: 'none', color: 'var(--foreground)',
      borderBottom: last ? undefined : '1px solid var(--border)',
    }}>
      {move && !lent ? (
        <span style={{
          width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--muted)', color: 'var(--muted-foreground)',
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 8h13l-3-3M17 16H4l3 3" />
          </svg>
        </span>
      ) : (
        <Chip icon={e.icon} tint={e.tint} size={38} />
      )}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {cameBack
            ? `Came back from ${e.people ?? 'them'}`
            : e.merchant || e.category || (lent ? 'Laid out' : move ? 'Transfer' : 'Entry')}
        </span>
        <span style={{
          fontSize: 'var(--step--2)', color: 'var(--muted-foreground)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lent
            ? `lent to ${e.people ?? 'them'}`
            : cameBack
              ? `into ${(move ? e.counter_account : e.account) ?? e.account}`
            : move && e.counter_account
              ? `${e.account} → ${e.counter_account}`
              : [e.merchant ? e.category : null, e.method ?? e.account].filter(Boolean).join(' · ')}
          {carried && ' · not your spending'}
          {e.is_shared && !carried && ' · shared'}
        </span>
      </span>
      <span className="t amt" style={{
        fontSize: 'var(--step-0)', letterSpacing: '-.01em',
        /* Money in is green, money out is red, and a move between your own
           accounts is neither — it is the same money in a different pocket. */
        color: incoming || cameBack ? 'var(--money-in)'
          : move ? 'var(--muted-foreground)' : 'var(--money-out)',
      }}>
        {incoming || cameBack ? '+' : ''}{format(Number(e.amount))}
      </span>
    </Link>
  );
}

function Pen() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M13.5 6.5l3 3" />
    </svg>
  );
}
function Bin() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16" /><path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </svg>
  );
}
