'use client';

import Link from '@/app/NavLink';
import { useActionState, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Problem, keepFields } from '../../worth/fields';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import BottomDrawer from '../../BottomDrawer';
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
      <div className="flex flex-wrap gap-2">
        {people.map((p) => (
          <button key={p.id} type="button" onClick={() => { haptic('tap'); setOpen(true); }}
            className="press flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1.5 pr-3 text-sm font-semibold text-foreground">
            <Face name={p.name} tint={p.tint} size={30} />
            {first(p.name)}
            <span className="flex items-center gap-0.5 font-medium text-muted-foreground">
              {p.owed > 0 ? format(p.owed) : p.inAll > 0 ? <><Icon name="check" size={14} />settled</> : null}
            </span>
          </button>
        ))}
        {canEdit && (
          <button type="button" onClick={() => { haptic('select'); setOpen(true); }}
            className="press flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-input pl-3 pr-3.5 text-sm font-semibold text-muted-foreground">
            <Icon name="plus" size={16} />
            {people.length === 0 ? 'Add a contact' : 'Contact'}
          </button>
        )}
      </div>

      <BottomDrawer open={open} onClose={close} label="People on this tab" showTitle>
        <div className="flex flex-col gap-4 pt-0.5">

          {people.length > 0 && (
            <ul className="flex flex-col">
              {people.map((p) => (
                <li key={p.id} className="flex min-h-15 items-center gap-3 border-b border-border last:border-b-0">
                  <Face name={p.name} tint={p.tint} />
                  <Link href={`/people/${p.id}`} transitionTypes={['nav-forward']}
                    className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 text-foreground">
                    <span className="text-[15px] font-semibold">
                      {p.name}{!p.onTab && <span className="font-medium text-muted-foreground"> · left the tab</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.inAll === 0 ? 'nothing on the tab yet'
                        : p.owed === 0 ? `settled · ${format(p.inAll)} in all`
                        : `owes ${format(p.owed)} of ${format(p.inAll)}`}
                    </span>
                  </Link>
                  {canEdit && p.onTab && p.owed === 0 && (
                    <form noValidate onSubmit={keepFields(drop)}>
                      <input type="hidden" name="tabId" value={tabId} />
                      <input type="hidden" name="counterpartyId" value={p.id} />
                      <Button type="submit" variant="ghost" className="h-11 px-3 font-semibold text-muted-foreground">Remove</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {dropped && !dropped.ok && <Problem>{dropped.error}</Problem>}

          {canEdit && (
            /* In a drawer (script needed to open it): keepFields keeps the names typed after a refusal. A new round of
               chips comes from the key once they are on the tab. */
            <form key={round} noValidate onSubmit={keepFields(add)} className="flex flex-col gap-2.5">
              <input type="hidden" name="tabId" value={tabId} />
              <span className="text-sm font-medium text-muted-foreground">Add someone</span>
              <NewPeople />
              {added && !added.ok && <Problem>{added.error}</Problem>}
              <Button type="submit" disabled={adding} className="h-12 rounded-xl text-base font-semibold">
                {adding ? 'Adding…' : 'Add to this tab'}
              </Button>
              <p className="text-xs leading-snug text-muted-foreground">
                Costs from now on split between everyone on the tab. What is already on it stays as it was.
              </p>
            </form>
          )}
        </div>
      </BottomDrawer>
    </>
  );
}
