'use client';

import { useActionState, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorNote as Problem } from '../auth-ui';
import { Field } from '../worth/fields';
import { keepFields } from '../form-hooks';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import { headerPill } from '../form-bits';
import BottomDrawer from '../BottomDrawer';
import { createTab } from './actions';
import NewPeople from './NewPeople';

/* Opening a tab asks for nothing it cannot do without. The name is optional —
   left blank, the tab is named after whoever is on it — and so are the people:
   a tab with nobody on it still takes costs and still counts in what you are
   owed. People come from the phone's address book where the browser has one,
   or are typed; either way they are only names on this tab, and a name that
   is already on another tab is the same person, not a second one.

   The button sits in the Loans header. The form is in a drawer, which cannot open without script, so it submits
   through keepFields: a refusal keeps the name and the people chips as typed instead of React's form reset. */
export default function NewTab() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, act, pending] = useActionState(createTab, null);

  return (
    <>
      <button type="button" onClick={() => { haptic('select'); setOpen(true); }}
        className={`${headerPill} bg-primary text-primary-foreground`}>
        <Icon name="add" size={18} />
        New tab
      </button>

      <BottomDrawer open={open} onClose={close} label="New tab" showTitle>
        <form noValidate onSubmit={keepFields(act)} className="flex flex-col gap-4 pt-0.5">
          <Field label="Name · optional" name="name" maxLength={60}
            placeholder="Goa weekend, Office petrol…" autoComplete="off" />

          <div role="group" aria-label="Who owes on it" className="flex flex-col gap-2">
            <span className="text-subhead font-medium text-muted-foreground">Who owes on it · optional</span>
            <NewPeople />
            <p className="text-footnote leading-snug text-muted-foreground">
              A cost on this tab splits equally between the people on it. Leave it empty and the
              tab still counts in what you are owed.
            </p>
          </div>

          {state && !state.ok && <Problem>{state.error}</Problem>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={close} className="h-12 rounded-xl px-4 text-headline font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl text-headline font-semibold">
              <Icon name="folder" size={18} />
              {pending ? 'Opening…' : 'Open the tab'}
            </Button>
          </div>
        </form>
      </BottomDrawer>
    </>
  );
}
