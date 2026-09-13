'use client';

import Link from 'next/link';
import { useActionState, useCallback, useState } from 'react';
import { ErrorNote } from '../../auth-ui';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import Sheet from '../../Sheet';
import { useMoney } from '@/app/currency';
import { addToTab, removeFromTab } from '../actions';
import NewPeople from '../NewPeople';
import { Face } from '../look';

type Person = { id: string; name: string; tint: string; onTab: boolean; inAll: number; owed: number };

/* Who is on the tab, in its header — each a chip with what they still owe —
   and the one door to changing that. Contacts are optional labels on a tab:
   picked from the phone book where the browser has one, typed where it does
   not (Safari has no contact picker, so on an iPhone typing is the way in). */
export default function TabContacts({ tabId, people, canEdit }: {
  tabId: string; people: Person[]; canEdit: boolean;
}) {
  const { format } = useMoney();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // A fresh set of name chips once the last ones are on the tab.
  const [round, setRound] = useState(0);
  const [added, add, adding] = useActionState(async (prev: Awaited<ReturnType<typeof addToTab>> | null, fd: FormData) => {
    const r = await addToTab(prev, fd);
    if (r.ok) setRound((n) => n + 1);
    return r;
  }, null);
  const [dropped, drop] = useActionState(removeFromTab, null);

  const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

  if (people.length === 0 && !canEdit) return null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
        {people.map((p) => (
          <button key={p.id} type="button" onClick={() => { haptic('tap'); setOpen(true); }} style={{
            minHeight: 44, padding: '0 12px 0 6px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.2)', color: '#fff',
            fontSize: 'var(--step--1)', fontWeight: 600,
          }}>
            <Face name={p.name} tint={p.tint} size={30} />
            {first(p.name)}
            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {p.owed > 0 ? format(p.owed) : p.inAll > 0 ? <><Icon name="check" size={13} strokeWidth={2.6} />settled</> : null}
            </span>
          </button>
        ))}
        {canEdit && (
          <button type="button" onClick={() => { haptic('select'); setOpen(true); }} style={{
            minHeight: 44, padding: '0 14px 0 11px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6,
            border: '1px dashed rgba(255,255,255,.42)', color: 'rgba(255,255,255,.92)',
            fontSize: 'var(--step--1)', fontWeight: 600,
          }}>
            <Icon name="plus" size={15} strokeWidth={2.2} />
            {people.length === 0 ? 'Add a contact' : 'Contact'}
          </button>
        )}
      </div>

      <Sheet open={open} onClose={close} label="People on this tab">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
          <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>People on this tab</h2>

          {people.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {people.map((p, i) => (
                <li key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 62,
                  borderBottom: i === people.length - 1 ? undefined : '1px solid var(--c-rule)',
                }}>
                  <Face name={p.name} tint={p.tint} />
                  <Link href={`/people/${p.id}`} transitionTypes={['nav-forward']} style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
                    textDecoration: 'none', color: 'var(--c-ink)',
                  }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                      {p.name}{!p.onTab && <span style={{ fontWeight: 500, color: 'var(--c-meta)' }}> · left the tab</span>}
                    </span>
                    <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                      {p.inAll === 0 ? 'nothing on the tab yet'
                        : p.owed === 0 ? `settled · ${format(p.inAll)} in all`
                        : `owes ${format(p.owed)} of ${format(p.inAll)}`}
                    </span>
                  </Link>
                  {canEdit && p.onTab && p.owed === 0 && (
                    <form action={drop}>
                      <input type="hidden" name="tabId" value={tabId} />
                      <input type="hidden" name="counterpartyId" value={p.id} />
                      <button type="submit" className="cta" style={{
                        minHeight: 44, padding: '0 12px', fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)',
                      }}>Remove</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {dropped && !dropped.ok && <ErrorNote>{dropped.error}</ErrorNote>}

          {canEdit && (
            <form key={round} action={add} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="tabId" value={tabId} />
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Add someone</span>
              <NewPeople />
              {added && !added.ok && <ErrorNote>{added.error}</ErrorNote>}
              <button className="cta" type="submit" disabled={adding} style={{
                minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: adding ? 0.65 : 1,
              }}>{adding ? 'Adding…' : 'Add to this tab'}</button>
              <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                Costs from now on split between everyone on the tab. What is already on it stays as it was.
              </p>
            </form>
          )}
        </div>
      </Sheet>
    </>
  );
}
