'use client';

import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fieldLabel } from '../form-bits';

/* The small pieces every holdings form shares, so the drawers read as one family. */

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

/** Submit a form to an action WITHOUT React's reset of uncontrolled fields: a `<form action>` clears every
 *  field once the action settles, even when it comes back refused, which wiped what was typed exactly when the
 *  person needs to correct it. Only for forms that need script anyway (a drawer cannot open without it). */
export function keepFields(act: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => act(fd));
  };
}

/** For a page-level form that must keep working without script, so it posts through `<form action>`: React 19
 *  resets the form once the action settles, refusals included, and a reset puts every radio, checkbox and select
 *  back to how it was first drawn while React's state still shows the choice — so a corrected resubmit would quietly
 *  send the old answers. With script, this notes each field's value as the form is sent and, once a refusal comes
 *  back (after the reset has run), puts the same values back into the DOM, so what is on screen, React's state and
 *  what the next submit sends agree again. Typed text comes back too. Spread the result onto the <form>.
 *  Without script there is no reset to undo: the page reloads with the refusal. */
export function useKeepOnRefusal(state: object | null | undefined) {
  const ref = useRef<HTMLFormElement>(null);
  const sent = useRef<[HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, string | boolean][] | null>(null);
  const onSubmit = () => {
    const form = ref.current;
    if (!form) return;
    sent.current = [];
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement) {
        if (['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) continue;
        sent.current.push([el, el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value]);
      } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        sent.current.push([el, el.value]);
      }
    }
  };
  useEffect(() => {
    // Passive effects run after the commit in which React reset the form, so this lands last.
    if (!state || (state as { ok?: boolean }).ok || !sent.current) return;
    for (const [el, v] of sent.current) {
      if (typeof v === 'boolean') (el as HTMLInputElement).checked = v;
      else el.value = v;
    }
    sent.current = null;
  }, [state]);
  return { ref, onSubmit };
}
