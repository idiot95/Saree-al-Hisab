'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fieldLabel } from '../form-bits';

/* The small pieces every holdings form shares, so the drawers read as one family. The form-state hooks that every
   form in the app uses (keepFields, useKeepOnRefusal, useOnSuccess, useFocusSoon) are in src/app/form-hooks.tsx. */

export function Field({ label, hint, ...rest }: { label: string; hint?: string } & React.ComponentProps<'input'>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <Input {...rest} className="h-12 rounded-xl bg-card px-3.5 text-[length:var(--field)] md:text-[length:var(--field)]" />
      {hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Whose it is: Joint, or one member. Radix's select cannot hold an empty value, so the choice is mirrored into
 *  a hidden `owner` field the action reads ('' is joint). */
export function OwnerSelect({ members, defaultValue = null, label = 'Whose is it', keepUnlessChanged = false }: {
  members: { id: string; name: string }[]; defaultValue?: string | null; label?: string;
  /** Send `owner` only once the choice is changed, so a stored owner the list cannot show (someone who has
   *  left) is kept as it is rather than quietly rewritten to Joint by an unrelated edit. */
  keepUnlessChanged?: boolean;
}) {
  const id = useId();
  const initial = defaultValue && members.some((m) => m.id === defaultValue) ? defaultValue : 'joint';
  const [v, setV] = useState(initial);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={fieldLabel}>{label}</span>
      {(!keepUnlessChanged || v !== initial) && <input type="hidden" name="owner" value={v === 'joint' ? '' : v} />}
      <Select value={v} onValueChange={setV}>
        <SelectTrigger aria-labelledby={id} className="h-12 w-full rounded-xl bg-card px-3.5 text-[length:var(--field)] data-[size=default]:h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="joint" className="min-h-11">Joint</SelectItem>
          {members.map((m) => <SelectItem key={m.id} value={m.id} className="min-h-11">{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A refusal: the one error note the app draws (auth-ui's ErrorNote), under the name the holdings forms use. */
export { ErrorNote as Problem } from '../auth-ui';
