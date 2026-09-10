'use client';

import { useActionState, useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { ErrorNote } from '../auth-ui';
import { useMoney } from '@/app/currency';
import {
  createBudgetSet, updateBudgetSet, useBudgetSet, retireBudgetSet, deleteBudgetSet,
} from './actions';
import type { Category } from '../CategoryFinder';

/* Budgets, as things you keep rather than a figure you overwrite.

   The current one is the screen: its headings, how each is going this month,
   and the total. Underneath are the others — "Ramadan", "After the wedding" —
   each a tap away from being current, and the one you leave keeps every
   figure it had. That is the whole point: trying a leaner month used to mean
   typing over what you had and typing it back from memory afterwards.

   Editing, putting away and deleting are all on the budget itself rather than
   in a menu somewhere, because they are three answers to one question — what
   do I do with this budget — and hiding two of them behind an icon makes a
   person guess which. */

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
  const { format } = useMoney();
  const current = budgets.find((b) => b.current) ?? null;
  const others = budgets.filter((b) => !b.current);
  const linesOf = (id: string) => lines.filter((l) => l.set_id === id);

  if (editing === 'new' || (budgets.length === 0 && editing === null)) {
    return (
      <BudgetForm categories={categories} budget={null} lines={[]} thisMonth={thisMonth}
        onDone={() => setEditing(null)} showCancel={budgets.length > 0} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {current && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editing === current.id ? (
            <BudgetForm categories={categories} budget={current} lines={linesOf(current.id)}
              thisMonth={thisMonth} onDone={() => setEditing(null)} showCancel />
          ) : (
            <>
              <Head name={current.name} note={`${monthName(current.from_month)} — ${monthName(current.to_month)}`}
                badge="In use" total={format(Number(current.total))} />
              <div className="el card" style={{
                margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18,
                padding: '0 var(--pad)', overflow: 'hidden',
              }}>
                {linesOf(current.id).map((l, i) => {
                  const cap = Number(l.amount);
                  const used = Number(spentBy[l.category_id] ?? 0);
                  const share = cap > 0 ? Math.min(1, used / cap) : 0;
                  return (
                    <div key={l.category_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 72,
                      borderBottom: i === linesOf(current.id).length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <Chip icon={l.icon} tint={l.tint} />
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{l.name}</span>
                        <span aria-hidden style={{
                          height: 5, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden',
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
                      </span>
                      <span className="t n" style={{ fontSize: 'var(--step-0)' }}>{format(cap)}</span>
                    </div>
                  );
                })}
              </div>
              <Actions budget={current} onEdit={() => setEditing(current.id)} />
            </>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Head name={current ? 'Put away' : 'Your budgets'}
            note={current ? 'Tap one to use it instead. Nothing about this one is lost.' : 'Tap one to start using it.'} />
          {others.map((b) => (
            <div key={b.id} style={{ margin: '0 var(--gutter)' }}>
              {editing === b.id ? (
                <BudgetForm categories={categories} budget={b} lines={linesOf(b.id)}
                  thisMonth={thisMonth} onDone={() => setEditing(null)} showCancel />
              ) : (
                <Resting budget={b} lines={linesOf(b.id)} onEdit={() => setEditing(b.id)} />
              )}
            </div>
          ))}
        </section>
      )}

      <button type="button" onClick={() => { haptic('select'); setEditing('new'); }} className="el card"
        style={{
          margin: '0 var(--gutter)', minHeight: 56, borderRadius: 16, display: 'flex',
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
        Create another budget
      </button>
    </div>
  );
}

function Head({ name, note, badge, total }: {
  name: string; note: string; badge?: string; total?: string;
}) {
  return (
    <div style={{ padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
          {name}
        </h2>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999,
            background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
          }}>{badge}</span>
        )}
        {total && <span className="t n" style={{ marginLeft: 'auto', fontSize: 'var(--step-0)', fontWeight: 700 }}>{total}</span>}
      </span>
      <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>{note}</p>
    </div>
  );
}

/* A budget not in use: what it is, and the one obvious thing to do with it. */
function Resting({ budget, lines, onEdit }: { budget: Budget; lines: Line[]; onEdit: () => void }) {
  const [state, act, pending] = useActionState(useBudgetSet, null);
  const { format } = useMoney();
  return (
    <div className="el card" style={{
      background: 'var(--c-card)', borderRadius: 18, padding: 'var(--pad)',
      display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--step-0)', fontWeight: 600 }}>{budget.name}</span>
        <span className="t n" style={{ fontSize: 'var(--step-0)', fontWeight: 700 }}>
          {format(Number(budget.total))}
        </span>
      </span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {lines.slice(0, 5).map((l) => (
          <span key={l.category_id} aria-hidden style={{
            width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: `var(--cat-${l.tint})`, color: `var(--cat-${l.tint}-ink)`,
          }}>
            <Icon name={l.icon} size={14} strokeWidth={1.9} />
          </span>
        ))}
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)', alignSelf: 'center' }}>
          {budget.lines} {budget.lines === 1 ? 'heading' : 'headings'} ·{' '}
          {monthName(budget.from_month)} — {monthName(budget.to_month)}
        </span>
      </span>
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 8 }}>
        <form action={act} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={budget.id} />
          <button className="cta" type="submit" disabled={pending} onClick={() => haptic('select')} style={{
            width: '100%', minHeight: 44, borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 700,
            background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.6 : 1,
          }}>{pending ? 'Switching…' : 'Use this budget'}</button>
        </form>
        <button type="button" onClick={onEdit} style={{
          minHeight: 44, padding: '0 14px', borderRadius: 12, fontSize: 'var(--step--1)',
          fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-ink)',
        }}>Edit</button>
      </div>
    </div>
  );
}

/* Edit, put away, delete — the three things you can do to the budget in use. */
function Actions({ budget, onEdit }: { budget: Budget; onEdit: () => void }) {
  const [, retire, retiring] = useActionState(retireBudgetSet, null);
  const [dropState, drop, dropping] = useActionState(deleteBudgetSet, null);
  const [sure, setSure] = useState(false);

  return (
    <div style={{ margin: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onEdit} style={{
          flex: 1, minHeight: 46, borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 7, fontSize: 'var(--step--1)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-ink)',
        }}>
          <Icon name="pencil" size={16} strokeWidth={2} />
          Edit
        </button>
        <form action={retire} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={budget.id} />
          <button className="cta" type="submit" disabled={retiring} style={{
            width: '100%', minHeight: 46, borderRadius: 12, fontSize: 'var(--step--1)',
            fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-ink)',
          }}>{retiring ? 'Putting away…' : 'Put away'}</button>
        </form>
      </div>
      <form action={drop} onSubmit={(e) => { if (!sure) { e.preventDefault(); setSure(true); } }}>
        <input type="hidden" name="id" value={budget.id} />
        <button className="cta" type="submit" disabled={dropping} style={{
          width: '100%', minHeight: 42, borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
          background: sure ? 'var(--c-danger-tint)' : 'transparent', color: 'var(--c-danger)',
        }}>
          {dropping ? 'Deleting…' : sure ? `Yes, delete ${budget.name}` : 'Delete this budget'}
        </button>
      </form>
      {dropState && !dropState.ok && <ErrorNote>{dropState.error}</ErrorNote>}
      <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        Putting away or deleting clears the months ahead. Every month already gone stays exactly
        as it was.
      </p>
    </div>
  );
}

/* Creating and editing are one form: the difference is whether it arrives
   with figures already in it. */
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
              Call it
            </span>
            <input name="name" required maxLength={60} defaultValue={budget?.name ?? ''}
              placeholder="Normal months" style={FIELD} />
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>From</span>
              <input type="month" name="from" defaultValue={budget?.from_month ?? thisMonth} required style={FIELD} />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Until</span>
              <input type="month" name="to" defaultValue={budget?.to_month ?? addMonths(thisMonth, 11)}
                required style={FIELD} />
            </label>
          </div>

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
  minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
  border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
};
const GHOST: React.CSSProperties = {
  minHeight: 52, padding: '0 16px', borderRadius: 14, fontSize: 'var(--step-0)',
  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const SOLID: React.CSSProperties = {
  flex: 1, minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--g-primary)', color: 'var(--c-on-primary)',
};
