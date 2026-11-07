'use client';

import { useActionState, useState } from 'react';
import { rowRule } from '../../form-bits';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import { revokePhone, type RevokeResult } from './actions';

/* One phone that can forward messages. Revoke takes a second tap: the phone stops forwarding at once, and getting it
   back means a new key pasted into it. */
export default function PhoneRow({ id, label, who, created, used, canRevoke, last }: {
  id: string; label: string; who: string | null; created: string; used: string | null; canRevoke: boolean; last: boolean;
}) {
  const [sure, setSure] = useState(false);
  const [state, act, pending] = useActionState<RevokeResult, FormData>(revokePhone, null);
  return (
    <div className={`relative flex min-h-[76px] items-center gap-3 py-3 ${last ? '' : `${rowRule} [--rule-r:16px]`}`}>
      <span className="grid size-10 flex-none place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon name="smartphone" size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-headline font-semibold [overflow-wrap:anywhere]">{label}</span>
        <span className="text-subhead text-muted-foreground">
          {who ? `${who} · ` : ''}Added {created} · {used ? `last used ${used}` : 'not used yet'}
        </span>
        {state && !state.ok && (
          <span role="alert" className="flex items-center gap-1 text-body text-destructive"><Icon name="error" size={16} />{state.error}</span>
        )}
      </span>
      {canRevoke && (
        <form action={act} onSubmit={(e) => { if (!sure) { e.preventDefault(); haptic('select'); setSure(true); } }} className="flex-none">
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={pending} onBlur={() => setSure(false)}
            className={`press flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-body font-semibold in-data-[platform=android]:min-h-12 ${sure
              ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-destructive'}`}>
            {sure && <Icon name="warning" size={16} />}
            {pending ? 'Revoking…' : sure ? 'Tap to revoke' : 'Revoke'}
          </button>
        </form>
      )}
    </div>
  );
}
