'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '../Icon';

/* The small pieces every holdings form shares, so the drawers read as one family. */

export function Field({ label, hint, ...rest }: { label: string; hint?: string } & React.ComponentProps<'input'>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Input {...rest} className="h-12 rounded-xl bg-card px-3.5 text-[length:var(--field)]" />
      {hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Whose it is: Joint, or one member. Radix's select cannot hold an empty value, so the choice is mirrored into
 *  a hidden `owner` field the action reads ('' is joint). */
export function OwnerSelect({ members, defaultValue = null, label = 'Whose is it' }: {
  members: { id: string; name: string }[]; defaultValue?: string | null; label?: string;
}) {
  const id = useId();
  const [v, setV] = useState(defaultValue && members.some((m) => m.id === defaultValue) ? defaultValue : 'joint');
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium text-muted-foreground">{label}</span>
      <input type="hidden" name="owner" value={v === 'joint' ? '' : v} />
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

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <Icon name="error" size={18} />{children}
    </p>
  );
}
