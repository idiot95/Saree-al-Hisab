'use client';

import { EmptyLine } from '../../../entries/parts';
import Link from '@/app/NavLink';
import { useActionState, useState } from 'react';
import { ErrorNote, primaryBtn, quietBtn } from '../../../auth-ui';
import { Icon } from '../../../Icon';
import { haptic } from '../../../haptics';
import { DateChips } from '../../../DatePick';
import { useMoney } from '@/app/currency';
import { finishReconcile, undoReconcile } from '../../reconcile/actions';
import { useKeepOnRefusal } from '../../../form-hooks';

type Entry = { id: string; on: string; what: string; via: string | null; signed: number };

/* The working of a reconciliation, live as it is typed.

   Statement date and balance first — for a card, what the statement says is
   owed, which is the number printed biggest on it. Then every entry up to that
   date not yet matched, ticked by default, because most of them are on the
   statement. Untick what the statement does not show (a cheque not cleared,
   a payment still pending) and the difference moves as you do. At zero it
   finishes. Not at zero, the two honest ways out are said plainly: add the
   entry the books are missing, or record what is left as one adjustment. */
export default function Reconcile({ accountId, credit, today, lastOn, cleared, entries }: {
  accountId: string; credit: boolean; today: string; lastOn: string | null;
  /** The balance everything already matched adds up to, signed as balances are. */
  cleared: number; entries: Entry[];
}) {
  const { format, fromKeys } = useMoney();
  const [on, setOn] = useState(today);
  const [keys, setKeys] = useState('');
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [state, act, pending] = useActionState(finishReconcile, null);
  // A page-level form: it posts directly, and a refusal's reset (which would re-tick unticked rows on screen) is undone.
  const keep = useKeepOnRefusal(state);

  const upTo = entries.filter((e) => e.on <= on);
  const later = entries.length - upTo.length;
  const ticked = upTo.filter((e) => !unticked.has(e.id));
  const typed = keys.trim() !== '';
  const magnitude = typed ? fromKeys(keys.replace(/[^0-9.]/g, '')) : 0;
  // A card that owes is negative in the books; the statement prints it positive.
  const statement = credit ? -magnitude : magnitude;
  const reached = cleared + ticked.reduce((n, e) => n + e.signed, 0);
  const difference = statement - reached;
  const matches = typed && difference === 0;
  const shown = (v: number) => format(Math.abs(v));
  const signedText = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${format(Math.abs(v))}`;

  const toggle = (id: string) => setUnticked((s) => {
    haptic('select');
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  return (
    <form action={act} {...keep} aria-label="Match to a statement" className="flex flex-col gap-5">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="on" value={on} />
      <input type="hidden" name="balance" value={String(statement)} />
      {ticked.map((e) => <input key={e.id} type="hidden" name="txnId" value={e.id} />)}

      <section aria-label="The statement" className="mx-[var(--gutter)] flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]">
        <DateChips value={on} onChange={(v) => { setOn(v); setUnticked(new Set()); }} today={today}
          dir="past" min={lastOn ?? undefined} max={today} label="Statement date" />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">
            {credit ? 'What the statement says you owe' : 'Closing balance on the statement'}
          </span>
          <input inputMode="decimal" value={keys} placeholder="0" autoComplete="off"
            aria-label={credit ? 'Amount owed on the statement' : 'Statement balance'}
            onChange={(e) => setKeys(e.target.value.replace(/[^0-9.]/g, ''))}
            className="h-14 w-full rounded-xl border border-input bg-card px-3.5 text-[26px] font-semibold tracking-tight tabular-nums text-foreground" />
          {typed && <span className="text-xs text-muted-foreground">{format(magnitude)}</span>}
        </label>
      </section>

      {/* The working, live: statement, what is ticked, and the difference — with an icon and a word for each state. */}
      <section aria-live="polite" aria-label="The difference"
        className="mx-[var(--gutter)] flex flex-col gap-2 rounded-[18px] border border-border bg-background px-3.5 py-3">
        <Line label="Statement" value={typed ? shown(statement) : '—'} />
        <Line label={`Ticked off${ticked.length ? ` (${ticked.length})` : ''}`} value={shown(reached)} />
        <div className={`flex items-center gap-2 border-t border-border pt-2 text-[15px] font-semibold ${!typed ? 'text-muted-foreground' : matches ? 'text-primary' : 'text-attention-soft-foreground'}`}>
          {typed && <Icon name={matches ? 'check_circle' : 'warning'} size={18} />}
          <span className="flex-1">{!typed ? 'Enter the statement balance' : matches ? 'It matches' : 'Difference'}</span>
          {typed && !matches && <span className="tabular-nums">{shown(difference)}</span>}
        </div>
      </section>

      <section aria-labelledby="sec-unmatched" className="flex flex-col gap-1.5 px-[var(--gutter)]">
        <div className="flex min-h-11 items-center gap-2 px-0.5">
          <h2 id="sec-unmatched" className="flex-1 text-[13px] font-semibold text-muted-foreground">Not matched yet</h2>
          {upTo.length > 1 && (
            <button type="button" onClick={() => { haptic('select'); setUnticked(unticked.size ? new Set() : new Set(upTo.map((e) => e.id))); }}
              className="press flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-primary">
              <Icon name={unticked.size ? 'done_all' : 'remove'} size={18} />
              {unticked.size ? 'Tick all' : 'Untick all'}
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-[18px] bg-card">
          {upTo.map((e) => {
            const isOn = !unticked.has(e.id);
            return (
              <label key={e.id} className="flex min-h-[60px] cursor-pointer items-center gap-3 border-b border-border px-[var(--pad)] py-2.5 last:border-b-0">
                <input type="checkbox" checked={isOn} onChange={() => toggle(e.id)}
                  className="size-5 flex-none accent-primary" />
                <span className={`flex min-w-0 flex-1 flex-col gap-0.5 ${isOn ? '' : 'opacity-60'}`}>
                  <span className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{e.what}</span>
                  <span className="text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                    {new Date(`${e.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {e.via ? ` · ${e.via}` : ''}
                    {isOn ? '' : ' · not on the statement'}
                  </span>
                </span>
                <span className={`flex-none text-[15px] font-semibold tabular-nums ${isOn ? '' : 'opacity-60'} ${e.signed > 0 ? 'text-money-in' : ''}`}>
                  {signedText(e.signed)}
                </span>
              </label>
            );
          })}
          {upTo.length === 0 && (
            <EmptyLine icon="done_all" className="">Nothing to match up to this date.</EmptyLine>
          )}
        </div>
        {later > 0 && (
          <p className="px-0.5 text-[13px] leading-snug text-muted-foreground">
            {later} {later === 1 ? 'entry is' : 'entries are'} dated after the statement and {later === 1 ? 'waits' : 'wait'} for the next one.
          </p>
        )}
      </section>

      <div className="mx-[var(--gutter)] flex flex-col gap-2.5">
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        {matches || !typed ? (
          <button type="submit" name="adjust" value="no" disabled={!matches || pending} className={primaryBtn}>
            <Icon name="check" size={20} />
            {pending ? 'Saving…' : 'Finish — it matches'}
          </button>
        ) : (
          <>
            <p className="text-sm leading-normal text-muted-foreground">
              {difference > 0
                ? `The statement has ${shown(difference)} more than the books. Something that came in may be missing here, or something going out here is not on the statement yet.`
                : `The books have ${shown(difference)} more than the statement. Something that went out may be missing here, or something coming in here is not on the statement yet.`}
            </p>
            <Link href="/add" className={primaryBtn}>
              <Icon name="add" size={20} />
              Add the missing entry
            </Link>
            <button type="submit" name="adjust" value="yes" disabled={pending} className={quietBtn}>
              {pending ? 'Saving…' : `Record ${signedText(difference)} as an adjustment`}
            </button>
            <p className="text-[13px] leading-snug text-muted-foreground">
              An adjustment brings the balance in line on the statement date. It is not spending and not
              income, and undoing this match deletes it.
            </p>
          </>
        )}
      </div>
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5 text-sm">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Undo, on the latest statement only — asked once, then done. */
export function UndoLatest({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [state, act, pending] = useActionState(undoReconcile, null);
  return (
    <form action={act} onSubmit={(e) => { if (!sure) { e.preventDefault(); haptic('select'); setSure(true); } }}
      className="flex flex-none flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}
        className={`press flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold disabled:opacity-60 ${sure ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'}`}>
        <Icon name="restore" size={18} />{pending ? 'Undoing…' : sure ? 'Yes, undo' : 'Undo'}
      </button>
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
    </form>
  );
}
