'use client';

import { useActionState, useRef, useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { ErrorNote } from '../auth-ui';
import { useMoney } from '@/app/currency';
import SwipeRow, { type SwipeAction } from '../SwipeRow';
import {
  createBudgetSet, updateBudgetSet, useBudgetSet, deleteBudgetSet,
} from './actions';
import type { Category } from '../CategoryFinder';

/* Budgets, as things you keep rather than a figure you overwrite.

   One list, every budget the same shape, the one in use wearing a badge that
   says so. A row is its name, what it costs a month, and how many headings;
   tapping it opens the headings themselves with their figures — and, on the
   one in use, how each is going this month. Two budgets in different states
   used to be drawn two different ways, which meant the eye had to learn two
   layouts to answer one question.

   Making one current and deleting it are the swipe, because they are the two
   things you do TO a budget rather than inside it. The swipe is never the
   only way: SwipeRow draws a grip that opens on a tap, and the open row
   carries the same actions as buttons. */

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
  const [open, setOpen] = useState<string | null>(() => budgets.find((b) => b.current)?.id ?? null);
  const linesOf = (id: string) => lines.filter((l) => l.set_id === id);

  if (editing === 'new' || (budgets.length === 0 && editing === null)) {
    return (
      <BudgetForm categories={categories} budget={null} lines={[]} thisMonth={thisMonth}
        onDone={() => setEditing(null)} showCancel={budgets.length > 0} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
          Your budgets
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          {budgets.length === 1
            ? 'Tap it to see what each heading gets. Swipe for delete.'
            : 'Tap one to see what each heading gets. Swipe to make it current, or to delete it.'}
        </p>
      </div>

      {budgets.map((b) => (
        <div key={b.id} style={{ margin: '0 var(--gutter)' }}>
          {editing === b.id ? (
            <BudgetForm categories={categories} budget={b} lines={linesOf(b.id)}
              thisMonth={thisMonth} onDone={() => setEditing(null)} showCancel />
          ) : (
            <Row budget={b} lines={linesOf(b.id)} spentBy={spentBy}
              open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
              onEdit={() => setEditing(b.id)} />
          )}
        </div>
      ))}

      <button type="button" onClick={() => { haptic('select'); setEditing('new'); }} className="el card"
        style={{
          margin: '4px var(--gutter) 0', minHeight: 56, borderRadius: 16, display: 'flex',
          alignItems: 'center', gap: 11, padding: '0 var(--pad)', background: 'var(--c-card)',
          border: '1px dashed var(--c-dash)', color: 'var(--c-ink)',
          fontSize: 'var(--step-0)', fontWeight: 600,
        }}>
        <span style={{
          width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </span>
        Create a budget
      </button>
    </div>
  );
}

/* One budget: shut it is a name and a figure, open it is the headings. The
   swipe carries the two things done TO a budget; the open row repeats them as
   buttons so no action is reachable only by gesture. */
function Row({ budget, lines, spentBy, open, onToggle, onEdit }: {
  budget: Budget; lines: Line[]; spentBy: Record<string, string>;
  open: boolean; onToggle: () => void; onEdit: () => void;
}) {
  const { format } = useMoney();
  const [, use, using] = useActionState(useBudgetSet, null);
  const [dropState, drop, dropping] = useActionState(deleteBudgetSet, null);
  const [sure, setSure] = useState(false);
  const useRef_ = useRef<HTMLFormElement>(null);
  const dropRef = useRef<HTMLFormElement>(null);

  const actions: SwipeAction[] = [
    ...(budget.current ? [] : [{
      label: 'Make current', tone: 'primary' as const,
      icon: <Icon name="check" size={20} strokeWidth={2.4} />,
      act: () => { haptic('select'); useRef_.current?.requestSubmit(); },
    }]),
    {
      label: 'Delete', tone: 'danger' as const,
      icon: <Icon name="trash" size={20} strokeWidth={2} />,
      act: () => { haptic('warn'); setSure(true); dropRef.current?.requestSubmit(); },
    },
  ];

  return (
    <div className="el card" style={{
      background: 'var(--c-card)', borderRadius: 18, overflow: 'hidden',
      border: budget.current ? '1px solid var(--c-ok)' : '1px solid var(--c-border)',
    }}>
      {/* The forms the swipe fires. Kept out of the button so a tap on the row
          can never submit one by accident. */}
      <form ref={useRef_} action={use} hidden>
        <input type="hidden" name="id" value={budget.id} />
      </form>
      <form ref={dropRef} action={drop} hidden>
        <input type="hidden" name="id" value={budget.id} />
      </form>

      <SwipeRow actions={actions} commit={false}>
        <button type="button" onClick={() => { haptic('tap'); onToggle(); }} aria-expanded={open}
          style={{
            width: '100%', minHeight: 76, display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px var(--pad)', textAlign: 'left', color: 'var(--c-ink)',
          }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 'var(--step-0)', fontWeight: 700, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{budget.name}</span>
              {budget.current && (
                <span style={{
                  flex: 'none', fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
                  background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
                }}>In use</span>
              )}
            </span>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              {budget.lines} {budget.lines === 1 ? 'heading' : 'headings'} ·{' '}
              {monthName(budget.from_month)} — {monthName(budget.to_month)}
            </span>
          </span>
          <span className="t n" style={{ fontSize: 'var(--step-1)', fontWeight: 700 }}>
            {format(Number(budget.total))}
          </span>
          <span aria-hidden style={{
            display: 'flex', color: 'var(--c-off)',
            transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s',
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </button>
      </SwipeRow>

      {open && (
        <div style={{
          padding: '0 var(--pad) 14px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ borderTop: '1px solid var(--c-rule)' }} />
          {lines.map((l) => {
            const cap = Number(l.amount);
            const used = Number(spentBy[l.category_id] ?? 0);
            const share = cap > 0 ? Math.min(1, used / cap) : 0;
            return (
              <div key={l.category_id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Chip icon={l.icon} tint={l.tint} size={34} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    fontSize: 'var(--step--1)', fontWeight: 600, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{l.name}</span>
                  {/* How the month is going, but only on the budget actually in
                      use — a bar on a budget nobody is spending against would
                      be measuring against a figure that does not apply. */}
                  {budget.current && (
                    <>
                      <span aria-hidden style={{
                        height: 4, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden',
                      }}>
                        <span style={{
                          display: 'block', height: '100%', borderRadius: 999, width: `${share * 100}%`,
                          background: used > cap ? 'var(--c-danger-fill)'
                            : share > 0.85 ? 'var(--c-warn-fill)' : 'var(--c-ok-fill)',
                        }} />
                      </span>
                      <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                        {used > 0 ? `${format(used)} spent` : 'nothing spent yet'}
                      </span>
                    </>
                  )}
                </span>
                <span className="t n" style={{ fontSize: 'var(--step--1)', fontWeight: 700 }}>
                  {format(cap)}
                </span>
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button type="button" onClick={onEdit} style={{
              flex: 1, minHeight: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 7, fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)',
            }}>
              <Icon name="pencil" size={16} strokeWidth={2} />
              Edit
            </button>
            {!budget.current && (
              <button type="button" disabled={using}
                onClick={() => { haptic('select'); useRef_.current?.requestSubmit(); }}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 700,
                  background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: using ? 0.6 : 1,
                }}>{using ? 'Switching…' : 'Make current'}</button>
            )}
            {budget.current && (
              <button type="button" disabled={dropping}
                onClick={() => {
                  haptic('warn');
                  if (!sure) { setSure(true); return; }
                  dropRef.current?.requestSubmit();
                }}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 600,
                  background: sure ? 'var(--c-danger-tint)' : 'transparent', color: 'var(--c-danger)',
                }}>{dropping ? 'Deleting…' : sure ? 'Tap again to delete' : 'Delete'}</button>
            )}
          </div>
          {dropState && !dropState.ok && <ErrorNote>{dropState.error}</ErrorNote>}
          {budget.current && (
            <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
              Deleting clears the months ahead. Every month already gone stays as it was.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetForm({ categories, budget, lines, thisMonth, onDone, showCancel }: {
  categories: Category[]; budget: Budget | null; lines: Line[];
  thisMonth: string; onDone: () => void; showCancel: boolean;
}) {
  const [state, act, pending] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = budget ? await updateBudgetSet(prev as null, fd) : await createBudgetSet(prev as null, fd);
    if (r.ok) { haptic('success'); onDone(); } else haptic('warn');
    return r;
  }, null);
  const { format } = useMoney();
  const tops = categories.filter((c) => !c.parent_id);
  const [step, setStep] = useState<1 | 2>(budget ? 2 : 1);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(lines.map((l) => l.category_id)));
  const [amounts, setAmounts] = useState<Record<string, string>>(
    () => Object.fromEntries(lines.map((l) => [l.category_id, String(Number(l.amount) / 100)])),
  );
  const [current, setCurrent] = useState(true);

  const chosen = tops.filter((c) => picked.has(c.id));
  const total = chosen.reduce((n, c) => n + Math.round(Number(amounts[c.id] || 0) * 100), 0);
  const filled = chosen.filter((c) => Number(amounts[c.id] || 0) > 0).length;

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18,
      padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {budget && <input type="hidden" name="id" value={budget.id} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{
          fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--c-meta)',
        }}>{budget ? 'Editing' : `Step ${step} of 2`}</span>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>
          {budget ? budget.name : step === 1 ? 'What do you want to watch?' : 'How much a month?'}
        </h2>
        {!budget && (
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
            {step === 1
              ? 'Pick the headings that matter. Everything filed underneath one of them counts towards it.'
              : 'Give each a figure, name the budget, and say how long it runs.'}
          </p>
        )}
      </div>

      {step === 1 ? (
        <>
          <div role="group" aria-label="Which categories to budget" style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8,
          }}>
            {tops.map((c) => {
              const on = picked.has(c.id);
              const ink = `var(--cat-${c.tint}-ink)`;
              return (
                <button key={c.id} type="button" aria-pressed={on}
                  onClick={() => {
                    haptic('select');
                    setPicked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
                  }}
                  style={{
                    minHeight: 58, padding: '8px 10px', borderRadius: 13, display: 'flex',
                    alignItems: 'center', gap: 9, textAlign: 'left',
                    transition: 'background .15s, color .15s',
                    ...(on
                      ? { background: ink, color: 'var(--c-on-tint)', border: `1px solid ${ink}` }
                      : { background: 'var(--c-sunk)', color: 'var(--c-meta)', border: '1px solid transparent' }),
                  }}>
                  <Icon name={c.icon} size={19} strokeWidth={1.9} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 700, lineHeight: 1.2,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
                  }}>{c.name}</span>
                  {on && <Icon name="check" size={15} strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            {showCancel && (
              <button className="cta" type="button" onClick={onDone} style={GHOST}>Cancel</button>
            )}
            <button className="cta" type="button" disabled={picked.size === 0}
              onClick={() => { haptic('select'); setStep(2); }} style={{ ...SOLID, opacity: picked.size === 0 ? 0.5 : 1 }}>
              {picked.size === 0 ? 'Pick at least one' : `Next · ${picked.size} chosen`}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chosen.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Chip icon={c.icon} tint={c.tint} size={36} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.name}</span>
                <input name={`c_${c.id}`} inputMode="decimal" className="n"
                  value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="0" aria-label={`Budget for ${c.name}`}
                  style={{
                    width: 116, minHeight: 46, borderRadius: 11, padding: '0 12px',
                    textAlign: 'right', border: '1px solid var(--c-border)',
                    background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
                  }} />
              </label>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
              Name this budget
            </span>
            <input name="name" required maxLength={60} defaultValue={budget?.name ?? ''}
              placeholder="Normal months" style={FIELD} />
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              Whatever you would call it out loud — Ramadan, School year, After the wedding.
            </span>
          </label>

          {/* A native month input carries its own intrinsic width, which is
              wider than half a phone: without minWidth:0 the second one runs
              off the card rather than shrinking. */}
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>From</span>
              <input type="month" name="from" defaultValue={budget?.from_month ?? thisMonth} required style={FIELD} />
            </label>
            <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Until</span>
              <input type="month" name="to" defaultValue={budget?.to_month ?? addMonths(thisMonth, 11)}
                required style={FIELD} />
            </label>
          </div>

          {/* Whether it takes over now. A budget written for next Ramadan is
              not one you want applied to this month, so it is asked rather
              than assumed — and on the first budget there is nothing to take
              over FROM, so it is simply on. */}
          {!budget && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 11, minHeight: 52, padding: '0 13px',
              borderRadius: 13, background: current ? 'var(--c-ok-tint)' : 'var(--c-sunk)',
              transition: 'background .15s', cursor: 'pointer',
            }}>
              <input type="checkbox" name="current" value="yes" checked={current}
                onChange={(e) => { haptic('select'); setCurrent(e.target.checked); }}
                style={{ width: 19, height: 19, margin: 0, accentColor: 'var(--c-primary-hi)' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 'var(--step--1)', fontWeight: 600 }}>Make this my current budget</span>
                <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                  {current ? 'The months it covers start reporting against it.'
                    : 'Kept for later. You can switch to it any time.'}
                </span>
              </span>
            </label>
          )}

          {total > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              <b className="n" style={{ color: 'var(--c-ink)' }}>{format(total)}</b> a month across{' '}
              {filled} {filled === 1 ? 'heading' : 'headings'}.
            </p>
          )}

          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cta" type="button" onClick={() => (budget ? onDone() : setStep(1))} style={GHOST}>
              {budget ? 'Cancel' : 'Back'}
            </button>
            <button className="cta" type="submit" disabled={pending || filled === 0}
              style={{ ...SOLID, opacity: pending || filled === 0 ? 0.55 : 1 }}>
              {pending ? 'Saving…' : budget ? 'Save changes' : 'Create the budget'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

const FIELD: React.CSSProperties = {
  width: '100%', minWidth: 0, minHeight: 50, borderRadius: 13, padding: '0 10px',
  fontSize: 'var(--field)', border: '1px solid var(--c-border)',
  background: 'var(--c-card)', color: 'var(--c-ink)',
};
const GHOST: React.CSSProperties = {
  minHeight: 52, padding: '0 16px', borderRadius: 14, fontSize: 'var(--step-0)',
  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const SOLID: React.CSSProperties = {
  flex: 1, minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--g-primary)', color: 'var(--c-on-primary)',
};
