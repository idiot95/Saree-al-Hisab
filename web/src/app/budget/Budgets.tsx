'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { useMoney } from '@/app/currency';
import SwipeRow, { type SwipeAction } from '../SwipeRow';
import { Problem, keepFields } from '../worth/fields';
import {
  createBudgetSet, updateBudgetSet, useBudgetSet, deleteBudgetSet,
} from './actions';
import type { Category } from '../CategoryFinder';

/* Budgets, as things you keep rather than a figure you overwrite.

   One list, every budget the same shape, the one in use wearing a badge that says so and a primary edge. A row is
   its name, what it costs a month, and how many categories; tapping it opens the categories with their figures —
   and, on the one in use, how each is going this month.

   Making one current and deleting it are the swipe, because they are the two things you do TO a budget rather
   than inside it. The swipe is never the only way: the open row carries the same actions as buttons. */

export type Budget = {
  id: string; name: string; current: boolean;
  from_month: string; to_month: string; lines: number; total: string;
};
export type Line = {
  set_id: string; category_id: string; amount: string;
  name: string; icon: string; tint: string;
};

const monthName = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};
const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Budgets({ budgets, lines, categories, thisMonth, spentBy }: {
  budgets: Budget[]; lines: Line[]; categories: Category[];
  thisMonth: string; spentBy: Record<string, string>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  /* Shut by default: the screen above already shows this month by category. */
  const [open, setOpen] = useState<string | null>(null);
  const linesOf = (id: string) => lines.filter((l) => l.set_id === id);

  if (editing === 'new' || (budgets.length === 0 && editing === null)) {
    return (
      <section aria-label={budgets.length ? 'New budget' : 'Your budget'} className="mx-[var(--gutter)] flex flex-col gap-1.5">
        <h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">{budgets.length ? 'New budget' : 'Your budget'}</h2>
        <BudgetForm key="new" categories={categories} budget={null} lines={[]} thisMonth={thisMonth}
          onDone={() => setEditing(null)} showCancel={budgets.length > 0} />
      </section>
    );
  }

  return (
    <section aria-label="Your budgets" className="mx-[var(--gutter)] flex flex-col gap-1.5">
      <h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">Your budgets</h2>
      <p className="px-0.5 text-xs leading-snug text-muted-foreground">
        {budgets.length === 1
          ? 'Tap it to see what each category gets.'
          : 'Tap one to see what each category gets, or to make it current.'}
      </p>
      <div className="flex flex-col gap-2.5">
        {budgets.map((b) => (editing === b.id ? (
          <BudgetForm key={b.id} categories={categories} budget={b} lines={linesOf(b.id)}
            thisMonth={thisMonth} onDone={() => setEditing(null)} showCancel />
        ) : (
          <Row key={b.id} budget={b} lines={linesOf(b.id)} spentBy={spentBy}
            open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
            onEdit={() => setEditing(b.id)} />
        )))}
      </div>
      <button type="button" onClick={() => { haptic('select'); setEditing('new'); }}
        className="flex min-h-11 items-center gap-1.5 self-start px-0.5 text-sm font-semibold text-primary">
        <Icon name="add" size={18} />
        Create another budget
      </button>
    </section>
  );
}

/* One budget: shut it is a name and a figure, open it is the categories. The swipe carries the two things done TO
   a budget; the open row repeats them as buttons so no action is reachable only by gesture. The card keeps
   px-[var(--pad)] because SwipeRow's negative margin is --pad. */
function Row({ budget, lines, spentBy, open, onToggle, onEdit }: {
  budget: Budget; lines: Line[]; spentBy: Record<string, string>;
  open: boolean; onToggle: () => void; onEdit: () => void;
}) {
  const { format } = useMoney();
  const [madeState, makeCurrent, using] = useActionState(useBudgetSet, null);
  const [dropState, drop, dropping] = useActionState(deleteBudgetSet, null);
  const [sure, setSure] = useState(false);
  const useForm = useRef<HTMLFormElement>(null);
  const dropForm = useRef<HTMLFormElement>(null);

  const actions: SwipeAction[] = [
    ...(budget.current ? [] : [{
      label: 'Make current', tone: 'primary' as const,
      icon: <Icon name="check" size={20} />,
      act: () => { haptic('select'); useForm.current?.requestSubmit(); },
    }]),
    {
      label: 'Delete', tone: 'danger' as const,
      icon: <Icon name="trash" size={20} />,
      // The swipe with commit off is already the deliberate second tap.
      act: () => { haptic('warn'); setSure(true); dropForm.current?.requestSubmit(); },
    },
  ];
  const problem = (madeState && !madeState.ok && madeState.error) || (dropState && !dropState.ok && dropState.error);

  return (
    <div className={`overflow-hidden rounded-[18px] border-[1.5px] bg-card px-[var(--pad)] ${budget.current ? 'border-primary' : 'border-transparent'}`}>
      {/* The forms the swipe and the buttons fire. Kept out of the row's button so a tap on the row can never
          submit one by accident. */}
      <form ref={useForm} action={makeCurrent} hidden>
        <input type="hidden" name="id" value={budget.id} />
      </form>
      <form ref={dropForm} action={drop} hidden>
        <input type="hidden" name="id" value={budget.id} />
      </form>

      <SwipeRow actions={actions} commit={false} grip={false}>
        <button type="button" onClick={() => { haptic('tap'); onToggle(); }} aria-expanded={open}
          className="flex min-h-[72px] w-full items-center gap-3 py-2.5 text-left text-foreground">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{budget.name}</span>
              {budget.current && (
                <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  <Icon name="check_circle" size={13} />In use
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {budget.lines} {budget.lines === 1 ? 'category' : 'categories'} ·{' '}
              {monthName(budget.from_month)} to {monthName(budget.to_month)}
            </span>
          </span>
          <span className="flex-none text-[15px] font-semibold tabular-nums">{format(Number(budget.total))}</span>
          <Icon name="expand_more" size={20} className={`flex-none text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </SwipeRow>

      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border pb-3.5 pt-3">
          {lines.map((l) => {
            const cap = Number(l.amount);
            const used = Number(spentBy[l.category_id] ?? 0);
            const over = cap > 0 && used > cap;
            return (
              <div key={l.category_id} className="flex items-center gap-3">
                <Chip icon={l.icon} tint={l.tint} size={34} radius={10} iconSize={18} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium [overflow-wrap:anywhere]">{l.name}</span>
                  {/* How the month is going, on the budget actually in use only: a bar on a budget nobody is
                      spending against would measure against a figure that does not apply. */}
                  {budget.current && (
                    <>
                      <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-muted">
                        <span className={`block h-full rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${cap > 0 ? Math.min(100, (used / cap) * 100) : 0}%` }} />
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${over ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {over && <Icon name="warning" size={13} />}
                        {over ? `Over budget · ${format(used)} spent` : used > 0 ? `${format(used)} spent` : 'Nothing spent yet'}
                      </span>
                    </>
                  )}
                </span>
                <span className="flex-none text-sm font-semibold tabular-nums">{format(cap)}</span>
              </div>
            );
          })}

          <div className="mt-1 flex gap-2">
            <Button type="button" variant="secondary" onClick={onEdit}
              className="h-11 flex-1 rounded-xl text-sm font-semibold in-data-[platform=android]:h-12">
              <Icon name="edit" size={18} />Edit
            </Button>
            {!budget.current && (
              <Button type="button" disabled={using}
                onClick={() => { haptic('select'); useForm.current?.requestSubmit(); }}
                className="h-11 flex-1 rounded-xl text-sm font-semibold in-data-[platform=android]:h-12">
                <Icon name="check" size={18} />{using ? 'Switching…' : 'Make current'}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={dropping}
              onClick={() => {
                haptic('warn');
                if (!sure) { setSure(true); return; }
                dropForm.current?.requestSubmit();
              }}
              className={`h-11 flex-1 rounded-xl text-sm font-semibold text-destructive hover:text-destructive in-data-[platform=android]:h-12 ${sure ? 'bg-destructive/10' : ''}`}>
              <Icon name="trash" size={18} />{dropping ? 'Deleting…' : sure ? 'Tap again' : 'Delete'}
            </Button>
          </div>
          {problem && <Problem>{problem}</Problem>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {budget.current
              ? 'Deleting clears the months ahead. Every month already gone stays as it was.'
              : 'Making it current writes its figures from this month on. Months already gone stay as they were.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* Creating or editing a budget. Creating asks in two steps — which categories, then how much — and ends with
   the checkbox: a budget written for next Ramadan is not one to apply to this month, so whether it takes over is
   asked, and an unchecked box sends nothing (the action reads === 'yes').

   Submitted through keepFields, not <form action>: after a settled action React resets the form, and a reset puts
   a controlled checkbox back to its first state in the DOM while React's state stays as it was — so after a
   refusal the unticked "current" box came back ticked and the corrected resubmit adopted the budget. The form
   needs script anyway (its two steps are client state), so nothing is lost by skipping the native post. */
function BudgetForm({ categories, budget, lines, thisMonth, onDone, showCancel }: {
  categories: Category[]; budget: Budget | null; lines: Line[];
  thisMonth: string; onDone: () => void; showCancel: boolean;
}) {
  const [state, act, pending] = useActionState(budget ? updateBudgetSet : createBudgetSet, null);
  const { format, toKeys, fromKeys } = useMoney();
  const tops = categories.filter((c) => !c.parent_id);
  const [step, setStep] = useState<1 | 2>(budget ? 2 : 1);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(lines.map((l) => l.category_id)));
  const [amounts, setAmounts] = useState<Record<string, string>>(
    () => Object.fromEntries(lines.map((l) => [l.category_id, toKeys(Number(l.amount))])),
  );
  const [name, setName] = useState(budget?.name ?? '');
  const [from, setFrom] = useState(budget?.from_month ?? thisMonth);
  const [to, setTo] = useState(budget?.to_month ?? addMonths(thisMonth, 11));
  const [current, setCurrent] = useState(true);

  /* Saved: close the form (the page has already refreshed under it). Refused: the phone says so. */
  const seen = useRef(state);
  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;
    if (state.ok) { haptic('success'); onDone(); } else haptic('warn');
  }, [state, onDone]);

  const chosen = tops.filter((c) => picked.has(c.id));
  const minorOf = (id: string) => fromKeys((amounts[id] ?? '').replace(/[^0-9.]/g, '')) || 0;
  const total = chosen.reduce((n, c) => n + minorOf(c.id), 0);
  const filled = chosen.filter((c) => minorOf(c.id) > 0).length;

  return (
    <form onSubmit={keepFields(act)} className="flex flex-col gap-4 rounded-[18px] bg-card p-4">
      {budget && <input type="hidden" name="id" value={budget.id} />}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">{budget ? 'Editing' : `Step ${step} of 2`}</span>
        <h3 className="text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
          {budget ? budget.name : step === 1 ? 'What do you want to watch?' : 'How much a month?'}
        </h3>
        {!budget && (
          <p className="text-sm leading-snug text-muted-foreground">
            {step === 1
              ? 'Pick the categories that matter. Everything filed under one of them counts towards it.'
              : 'Give each a figure, name the budget, and say how long it runs.'}
          </p>
        )}
      </div>

      {step === 1 ? (
        <>
          <div role="group" aria-label="Which categories to budget" className="grid grid-cols-2 gap-2">
            {tops.map((c) => {
              const on = picked.has(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on}
                  onClick={() => {
                    haptic('select');
                    setPicked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
                  }}
                  className={`flex min-h-14 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors ${on
                    ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  <Chip icon={c.icon} tint={c.tint} size={30} radius={8} iconSize={16} />
                  <span className="min-w-0 flex-1 leading-tight [overflow-wrap:anywhere]">{c.name}</span>
                  {on && <Icon name="check" size={18} />}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {showCancel && (
              <Button type="button" variant="secondary" onClick={onDone} className="h-12 rounded-xl px-5 text-base font-semibold">Cancel</Button>
            )}
            <Button type="button" disabled={picked.size === 0} onClick={() => { haptic('select'); setStep(2); }}
              className="h-12 flex-1 rounded-xl text-base font-semibold">
              {picked.size === 0 ? 'Pick at least one' : `Next · ${picked.size} chosen`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {chosen.map((c) => (
              <label key={c.id} className="flex items-center gap-3">
                <Chip icon={c.icon} tint={c.tint} size={36} radius={10} />
                <span className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">{c.name}</span>
                <Input name={`c_${c.id}`} inputMode="decimal" value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="0" aria-label={`Budget for ${c.name}`}
                  className="h-12 w-[120px] flex-none rounded-xl bg-card px-3 text-right text-[length:var(--field)] tabular-nums" />
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Name this budget</span>
            <Input name="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Normal months" className="h-12 rounded-xl bg-card px-3.5 text-[length:var(--field)]" />
            <span className="text-xs leading-snug text-muted-foreground">
              Whatever you would call it out loud: Ramadan, School year, After the wedding.
            </span>
          </label>

          {/* A native month input carries its own intrinsic width, wider than half a phone: min-w-0 lets the two
              share the row rather than the second running off the card. */}
          <div className="flex gap-2.5">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">From</span>
              <Input type="month" name="from" value={from} onChange={(e) => setFrom(e.target.value)} required
                className="h-12 min-w-0 rounded-xl bg-card px-2.5 text-[length:var(--field)]" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Until</span>
              <Input type="month" name="to" value={to} onChange={(e) => setTo(e.target.value)} required
                className="h-12 min-w-0 rounded-xl bg-card px-2.5 text-[length:var(--field)]" />
            </label>
          </div>

          {!budget && (
            <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors ${current ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
              <input type="checkbox" name="current" value="yes" checked={current}
                onChange={(e) => { haptic('select'); setCurrent(e.target.checked); }}
                className="size-5 flex-none accent-primary" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Make this my current budget</span>
                <span className="text-xs opacity-80">
                  {current ? 'The months it covers start reporting against it.'
                    : 'Kept for later. You can switch to it any time.'}
                </span>
              </span>
            </label>
          )}

          {total > 0 && (
            <p className="text-sm text-muted-foreground">
              <b className="font-semibold text-foreground tabular-nums">{format(total)}</b> a month across{' '}
              {filled} {filled === 1 ? 'category' : 'categories'}.
            </p>
          )}

          {state && !state.ok && <Problem>{state.error}</Problem>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => (budget ? onDone() : setStep(1))}
              className="h-12 rounded-xl px-5 text-base font-semibold">
              {budget ? 'Cancel' : 'Back'}
            </Button>
            <Button type="submit" disabled={pending || filled === 0} className="h-12 flex-1 rounded-xl text-base font-semibold">
              {pending ? 'Saving…' : budget ? 'Save changes' : 'Create the budget'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
