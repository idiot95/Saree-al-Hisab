'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { Icon, tintOf } from '../../Icon';
import { haptic } from '../../haptics';
import {
  addToTab, removeFromTab, renameTab, toggleTabClosed, deleteTab, settleTab,
} from '../actions';
import { format } from '@/lib/money';
import NewPeople from '../NewPeople';

type Person = {
  id: string; name: string; tint: string; on_tab: boolean;
  owed_in_all: string; back: string; owed: string;
};
type Method = { id: string; name: string; funds: string };
/** One open claim on this tab: an entry somebody still owes for. */
type Open = { id: string; person_id: string; what: string; on: string; outstanding: number };

export default function TabPeople({
  tabId, tabName, note, people, closed, canEdit, methods, open = [], today,
}: {
  tabId: string; tabName: string; note: string | null;
  people: Person[]; closed: boolean; canEdit: boolean; methods: Method[]; open?: Open[]; today: string;
}) {
  const [, add] = useActionState(addToTab, null);
  const [, drop] = useActionState(removeFromTab, null);
  const [closeState, toggle, toggling] = useActionState(toggleTabClosed, null);
  const [, remove] = useActionState(deleteTab, null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  const onTab = people.filter((p) => p.on_tab);
  const rest = people.filter((p) => !p.on_tab);
  // Someone taken off the tab who still owes on it stays listed until settled:
  // leaving does not unspend what was spent for them.
  const owing = rest.filter((p) => Number(p.owed) > 0);

  return (
    <>
      <Head>{onTab.length === 0 ? 'Nobody on this tab yet' : 'On this tab'}</Head>
      {onTab.length > 0 && (
        <section className="el card" style={card}>
          {onTab.map((p, i) => (
            <Member key={p.id} p={p} last={i === onTab.length - 1 && owing.length === 0}
              tabId={tabId} methods={methods} today={today} canEdit={canEdit}
              entries={open.filter((c) => c.person_id === p.id)}
              open={settling === p.id} onOpen={() => setSettling(settling === p.id ? null : p.id)}>
              {canEdit && Number(p.owed) === 0 && (
                <form action={drop}>
                  <input type="hidden" name="tabId" value={tabId} />
                  <input type="hidden" name="counterpartyId" value={p.id} />
                  <button type="submit" style={quiet}>Remove</button>
                </form>
              )}
            </Member>
          ))}
          {owing.map((p, i) => (
            <Member key={p.id} p={p} last={i === owing.length - 1} left
              tabId={tabId} methods={methods} today={today} canEdit={canEdit}
              entries={open.filter((c) => c.person_id === p.id)}
              open={settling === p.id} onOpen={() => setSettling(settling === p.id ? null : p.id)} />
          ))}
        </section>
      )}

      {canEdit && (adding ? (
        <section className="el card" style={{ ...card, paddingTop: 4, paddingBottom: 4 }}>
          <form action={add} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 14px',
            borderBottom: rest.length ? '1px solid var(--c-rule)' : undefined }}>
            <input type="hidden" name="tabId" value={tabId} />
            <NewPeople known={people.map((p) => p.name)} />
            <button className="cta" type="submit" style={{
              minHeight: 46, borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)',
            }}>Add them to this tab</button>
          </form>
          {rest.length === 0 ? (
            <p style={{ margin: 0, padding: '18px 0', textAlign: 'center', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              Everyone you know is already on it.
              {' '}<Link href="/people" style={{ color: 'var(--g-primary)', fontWeight: 600 }}>Add a person</Link>
            </p>
          ) : rest.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 64,
              borderBottom: i === rest.length - 1 ? undefined : '1px solid var(--c-rule)',
            }}>
              <Initials p={p} />
              <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 600 }}>{p.name}</span>
              <form action={add}>
                <input type="hidden" name="tabId" value={tabId} />
                <input type="hidden" name="counterpartyId" value={p.id} />
                <button className="cta" type="submit" style={{
                  minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 'var(--step--1)',
                  fontWeight: 600, background: 'var(--g-primary)', color: 'var(--c-on-primary)',
                }}>Add</button>
              </form>
            </div>
          ))}
          <button type="button" onClick={() => setAdding(false)} style={{
            width: '100%', minHeight: 48, fontSize: 'var(--step--1)', fontWeight: 600,
            color: 'var(--c-meta)', background: 'transparent',
          }}>Done</button>
        </section>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="el cta" style={{
          margin: '0 var(--gutter) 22px', width: 'calc(100% - 36px)', minHeight: 54, borderRadius: 15,
          background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
          color: 'var(--c-ink)', fontSize: 'var(--step-0)', fontWeight: 600,
        }}>Add someone to this tab</button>
      ))}

      {canEdit && (
        <div style={{ margin: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editing ? (
            <EditTab tabId={tabId} name={tabName} note={note}
              onDone={() => setEditing(false)} />
          ) : (
            <button className="cta" type="button" onClick={() => setEditing(true)} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)',
            }}>
              <Icon name="pencil" size={17} strokeWidth={2} />
              Rename this tab
            </button>
          )}

          <form action={toggle}>
            <input type="hidden" name="tabId" value={tabId} />
            <button className="cta" type="submit" disabled={toggling} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)', opacity: toggling ? 0.6 : 1,
            }}>{closed ? 'Reopen this tab' : 'Close this tab'}</button>
          </form>
          <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            Closing files it away and stops it being offered when you add an expense. Nothing
            about what anyone owes changes.
          </p>
          {closeState && !closeState.ok && (
            <p role="alert" style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>
              {closeState.error}
            </p>
          )}

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} style={{
              minHeight: 46, fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-danger)',
              background: 'transparent',
            }}>Delete this tab</button>
          ) : (
            <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="hidden" name="tabId" value={tabId} />
              <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                Only the tab goes. Its entries stay in the books, and what each person owes for
                them stays on their own page.
              </p>
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="cta" type="button" onClick={() => setConfirming(false)} style={{
                  minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 'var(--step--1)',
                  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
                }}>Cancel</button>
                <button className="cta" type="submit" style={{
                  flex: 1, minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
                  background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
                }}>Delete the tab</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

/* One person's row: what is still to come back from them on this tab, and a
   Settle up that opens the form in place. The amount is left blank on purpose
   — blank is "all of it", which is what settling up usually means. */
function Member({ p, last, left, tabId, methods, today, canEdit, entries = [], open, onOpen, children }: {
  p: Person; last: boolean; left?: boolean; tabId: string; methods: Method[]; today: string;
  canEdit: boolean; entries?: Open[]; open: boolean; onOpen: () => void; children?: React.ReactNode;
}) {
  const owed = Number(p.owed);
  const all = Number(p.owed_in_all);
  const back = Number(p.back);
  const [state, act, pending] = useActionState(settleTab, null);
  useEffect(() => { if (state?.ok) onOpen(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Which of their entries this money is for. Nothing ticked is all of them,
     oldest first — the ordinary case, so it needs no taps. */
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const chosen = entries.filter((e) => ticked.has(e.id));
  const target = chosen.length ? chosen.reduce((n, e) => n + e.outstanding, 0) : owed;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 0',
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Initials p={p} />
        <Link transitionTypes={['nav-forward']} href={`/people/${p.id}`} style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
          textDecoration: 'none', color: 'var(--c-ink)',
        }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
            {p.name}{left && <span style={{ fontWeight: 500, color: 'var(--c-meta)' }}> · left the tab</span>}
          </span>
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
            {all === 0 ? 'nothing on the tab yet'
              : owed === 0 ? `settled up · ${format(all)} in all`
              : back > 0 ? `${format(back)} of ${format(all)} back`
              : `owes ${format(all)}, none back yet`}
          </span>
        </Link>
        {owed > 0 && (
          <span className="t" style={{ fontSize: 'var(--step-0)' }}>{format(owed)}</span>
        )}
        {canEdit && owed > 0 && (
          <button type="button" className="cta" aria-expanded={open}
            onClick={() => { haptic('select'); onOpen(); }} style={{
              minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
              background: open ? 'var(--c-sunk)' : 'var(--g-primary)',
              color: open ? 'var(--c-meta)' : 'var(--c-on-primary)',
            }}>{open ? 'Cancel' : 'Settle up'}</button>
        )}
        {children}
      </div>

      {open && owed > 0 && (
        <form action={act} style={{
          display: 'flex', flexDirection: 'column', gap: 10, padding: 13, borderRadius: 14,
          background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
        }}>
          <input type="hidden" name="tabId" value={tabId} />
          <input type="hidden" name="counterpartyId" value={p.id} />
          {entries.length > 1 && (
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0, marginBottom: 6 }}>
                For which entries — none ticked means all of them
              </legend>
              {entries.map((e) => {
                const on = ticked.has(e.id);
                return (
                  <label key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer',
                    fontSize: 'var(--step--1)',
                  }}>
                    <input type="checkbox" name="claimId" value={e.id} checked={on}
                      onChange={(ev) => setTicked((s) => {
                        const n = new Set(s); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n;
                      })}
                      style={{ width: 18, height: 18, margin: 0, flex: 'none', accentColor: 'var(--c-seagrass)' }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.what} <span style={{ color: 'var(--c-meta)' }}>· {new Date(e.on + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="t" style={{ fontSize: 'var(--step--1)' }}>{format(e.outstanding)}</span>
                  </label>
                );
              })}
            </fieldset>
          )}
          <Field label={`Amount — blank settles all ${format(target)}`} name="amount"
            inputMode="decimal" placeholder={format(target)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Came in by</span>
            <select name="methodId" required style={select}>
              {methods.map((m) => <option key={m.id} value={m.id}>{m.name === m.funds ? m.name : `${m.name} — ${m.funds}`}</option>)}
            </select>
          </label>
          <Field label="On" name="occurred_on" type="date" defaultValue={today} required />
          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <button className="cta" type="submit" disabled={pending} style={{
            minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
            background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
          }}>
            <Icon name="check" size={18} strokeWidth={2.2} />
            {pending ? 'Recording…' : 'Record what came back'}
          </button>
          <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            {chosen.length ? 'Goes against the entries ticked, oldest first.' : 'Goes against their oldest entries on this tab first.'}
            {' '}Recorded as money coming back, not income — the spending stays in the month it happened.
          </p>
        </form>
      )}
    </div>
  );
}

function EditTab({ tabId, name, note, onDone }: {
  tabId: string; name: string; note: string | null; onDone: () => void;
}) {
  const [state, act, pending] = useActionState(renameTab, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={act} className="el card" style={{
      background: 'var(--c-card)', borderRadius: 16, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <input type="hidden" name="tabId" value={tabId} />
      <Field label="Name" name="name" defaultValue={name} required maxLength={60} autoFocus />
      <Field label="Note (optional)" name="note" defaultValue={note ?? ''} maxLength={200} />
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 9 }}>
        <button className="cta" type="button" onClick={onDone} style={{
          minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 'var(--step--1)',
          fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button className="cta" type="submit" disabled={pending} style={{
          flex: 1, minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function Initials({ p }: { p: Person }) {
  const [bg, ink] = tintOf(p.tint);
  return (
    <span style={{
      width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--1)', fontWeight: 700,
      background: bg, color: ink,
    }}>{p.name.slice(0, 2).toUpperCase()}</span>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

const card: React.CSSProperties = {
  margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
};
const quiet: React.CSSProperties = {
  minHeight: 44, padding: '0 10px', fontSize: 'var(--step--1)', fontWeight: 600,
  color: 'var(--c-meta)', background: 'transparent',
};
const select: React.CSSProperties = {
  minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
  background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--step-0)',
  fontWeight: 600, padding: '0 12px',
};
