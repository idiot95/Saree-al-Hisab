'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { useMoney } from '@/app/currency';
import { removeEntry, restoreEntry } from './actions';
import { startPending } from '../pending';
import { Chip, Icon } from '../Icon';

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
/* Activity's All can narrow the month by what kind of money it was, and find a line by any word on it. Both run
   over the month already on screen, so they answer as you type. (The chips above — All, To review, Upcoming,
   From SMS — choose the view; these only narrow the list, so they are drawn smaller and lead with "Every kind".) */
const FILTERS = [
  { key: 'all', label: 'Every kind', test: () => true },
  { key: 'spending', label: 'Spending', test: (e: Row) => e.kind === 'expense' },
  { key: 'income', label: 'Income', test: (e: Row) => INCOMING.has(e.kind) },
  { key: 'moves', label: 'Moves', test: (e: Row) => MOVES.has(e.kind) },
  { key: 'shared', label: 'Shared', test: (e: Row) => e.is_shared },
] as const;

export default function EntryList({ days, canEdit, tools = false, flat = false, initialQ = '', everyMonth = false }: {
  days: { on: string; label: string; rows: Row[] }[]; canEdit: boolean;
  /** Show search and the filter chips (Activity). */
  tools?: boolean;
  /** One card without day headings (Home's "Today"). */
  flat?: boolean;
  /** Arrived from a search: the words, and that the rows are from every month rather than one. */
  initialQ?: string; everyMonth?: boolean;
}) {
  const [q, setQ] = useState(initialQ);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const shown = useMemo(() => {
    /* Results the server found for these same words (a note, an amount) are not filtered again here: the list
       only narrows once the words are changed. */
    const words = everyMonth && q === initialQ ? [] : q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return days.map((d) => ({ ...d, rows: d.rows.filter((e) => test(e) && words.every((w) =>
      [e.merchant, e.category, e.method, e.account, e.counter_account, e.people].some((x) => x?.toLowerCase().includes(w)))) }));
  }, [days, q, filter, everyMonth, initialQ]);
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
        <div className="flex flex-col gap-1.5 px-[var(--gutter)] pb-3">
          {/* Typing narrows what is on screen at once; Enter searches every month on the server. A real GET form,
              so Enter works before the script has arrived too. */}
          <form action="/entries" method="get" role="search" onSubmit={(e) => {
            e.preventDefault();
            const words = q.trim();
            router.push(words ? `/entries?q=${encodeURIComponent(words)}` : '/entries');
          }}>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground focus-within:border-ring in-data-[platform=android]:min-h-12">
              <Icon name="search" size={18} />
              <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={everyMonth ? 'Search every month' : 'Search, or press Enter for every month'}
                aria-label="Search entries" enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent py-2 text-foreground outline-none placeholder:text-muted-foreground" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="-mr-2 grid size-11 flex-none place-items-center rounded-full in-data-[platform=android]:size-12"><span className="grid size-7 place-items-center rounded-full bg-muted"><Icon name="close" size={15} /></span></button>}
            </label>
          </form>
          {!everyMonth && q.trim() && (
            <Link href={`/entries?q=${encodeURIComponent(q.trim())}`} transitionTypes={['nav-forward']}
              className="flex min-h-11 items-center gap-2 self-start px-1 text-sm font-semibold text-primary">
              <Icon name="search" size={16} /> Search every month for “{q.trim()}”
            </Link>
          )}
          <div role="group" aria-label="Kind of entry"
            className="-mx-[var(--gutter)] flex overflow-x-auto px-[calc(var(--gutter)-0.5rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                className={`flex min-h-11 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[13px] ${filter === f.key
                  ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'}`}>
                {filter === f.key && <Icon name="check" size={16} />}{f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {tools && nothing && (
        <p className="mx-[var(--gutter)] rounded-[18px] bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          {q ? `Nothing ${everyMonth ? 'here' : 'this month'} matches “${q.trim()}”.` : `Nothing of that kind ${everyMonth ? 'here' : 'this month'}.`}
        </p>
      )}
      {shown.map((d) => {
        const rows = d.rows.filter((e) => !gone.has(e.id));
        if (rows.length === 0) return null;
        return (
          <section key={d.on} aria-label={flat ? undefined : d.label} className={flat ? '' : 'mb-4 flex flex-col gap-1.5'}>
            {!flat && (
              <h2 className="mx-[var(--gutter)] px-0.5 text-[13px] font-semibold text-muted-foreground">{d.label}</h2>
            )}
            <div className={`${flat ? '' : 'mx-[var(--gutter)]'} overflow-hidden rounded-[18px] bg-card px-[var(--pad)]`}>
              {rows.map((e, i) => (
                <SwipeRow key={e.id} actions={canEdit ? [
                  { label: 'Edit', tone: 'primary', icon: <Icon name="edit" size={20} />,
                    act: () => { startPending(`/entries/${e.id}`); router.push(`/entries/${e.id}`, { transitionTypes: ['nav-forward'] }); } },
                  { label: 'Delete', tone: 'danger', icon: <Icon name="delete" size={20} />, act: () => del(e) },
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
  /* Names wrap rather than trail off: "Came back from Imran Qureshi" is the whole point of the row. */
  return (
    <Link href={`/entries/${e.id}`} transitionTypes={['nav-forward']} draggable={false}
      className={`flex min-h-16 items-center gap-3 py-2.5 text-foreground no-underline ${last ? '' : 'border-b border-border'}`}>
      {move && !lent ? (
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-muted text-muted-foreground">
          <Icon name="swap_horiz" size={20} />
        </span>
      ) : (
        <Chip icon={e.icon} tint={e.tint} size={40} radius={12} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium [overflow-wrap:anywhere]">
          {cameBack
            ? `Came back from ${e.people ?? 'them'}`
            : e.merchant || e.category || (lent ? 'Laid out' : move ? 'Transfer' : 'Entry')}
        </span>
        <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
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
      {/* Money in is green with a +; money out is plain ink; a move between your own accounts is muted — the same
          money in a different pocket. */}
      <span className={`flex-none text-[15px] font-semibold tabular-nums ${incoming || cameBack
        ? 'text-money-in' : move ? 'text-muted-foreground' : 'text-foreground'}`}>
        {incoming || cameBack ? '+' : ''}{format(Number(e.amount))}
      </span>
    </Link>
  );
}
