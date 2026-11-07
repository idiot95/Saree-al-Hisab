'use client';

import { useActionState, useState } from 'react';
import { Icon } from '../Icon';
import { ErrorNote } from '../auth-ui';
import { archiveMethod, makeDefaultMethod } from './actions';

/* Under a way to pay: Default (a word with a check, the one this household reaches for first) or Make default,
   and Archive behind a second tap. Each a 44px target, in the row's quiet ink. */
const link = 'press flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-semibold disabled:opacity-60';

export function MethodControls({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [retireState, retire, retiring] = useActionState(archiveMethod, null);
  const [, setDefault] = useActionState(makeDefaultMethod, null);
  const [sure, setSure] = useState(false);

  return (
    <div className="-ml-2 flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {isDefault ? (
          <span className="ml-2 flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-footnote font-bold text-accent-foreground">
            <Icon name="check" size={14} />Default
          </span>
        ) : (
          <form action={setDefault}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={`${link} text-muted-foreground`}>Make default</button>
          </form>
        )}
        {sure ? (
          <form action={retire}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={retiring} className={`${link} text-destructive`}>
              <Icon name="archive" size={16} />{retiring ? 'Archiving…' : 'Confirm'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setSure(true)} className={`${link} text-muted-foreground`}>Archive</button>
        )}
      </div>
      {retireState && !retireState.ok && <div className="pl-2"><ErrorNote>{retireState.error}</ErrorNote></div>}
    </div>
  );
}
