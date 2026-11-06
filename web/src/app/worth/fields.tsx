'use client';

import { startTransition, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
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
 *  send the old answers. With script, this keeps a copy of each field's value from the moment the form is sent
 *  and, once a refusal comes back (after the reset has run), puts it back into the DOM, so what is on screen,
 *  React's state and what the next submit sends agree again. Typed text comes back too.
 *
 *  The copy is kept current until the action returns, not frozen at submit: every input or change while the action
 *  is pending re-reads the whole form (a radio's neighbours change without events of their own). So a field the
 *  person touched while waiting comes back as they left it, not as it was when they pressed the button — the reset
 *  wiped both, and the later one is the one the screen and React's state show.
 *  Spread the result onto the <form>. Without script there is no reset to undo: the page reloads with the refusal.
 *  A success is the other half: see `useOnSuccess`. */
type Kept = [HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, string | boolean | string[]][];
function readFields(form: HTMLFormElement): Kept {
  const out: Kept = [];
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement) {
      if (['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) continue;
      out.push([el, el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value]);
    } else if (el instanceof HTMLSelectElement) {
      out.push([el, el.multiple ? Array.from(el.selectedOptions, (o) => o.value) : el.value]);
    } else if (el instanceof HTMLTextAreaElement) {
      out.push([el, el.value]);
    }
  }
  return out;
}
export function useKeepOnRefusal(state: object | null | undefined) {
  const ref = useRef<HTMLFormElement>(null);
  const sent = useRef<Kept | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const onSubmit = () => {
    const form = ref.current;
    if (!form) return;
    stop.current?.();
    sent.current = readFields(form);
    const reread = () => { sent.current = readFields(form); };
    form.addEventListener('input', reread, true);
    form.addEventListener('change', reread, true);
    stop.current = () => {
      form.removeEventListener('input', reread, true);
      form.removeEventListener('change', reread, true);
      stop.current = null;
    };
  };
  useEffect(() => {
    // Passive effects run after the commit in which React reset the form, so this lands last.
    if (!state) return;
    stop.current?.();
    const kept = sent.current;
    sent.current = null;
    if ((state as { ok?: boolean }).ok || !kept) return;
    for (const [el, v] of kept) {
      if (typeof v === 'boolean') (el as HTMLInputElement).checked = v;
      else if (Array.isArray(v)) for (const o of Array.from((el as HTMLSelectElement).options)) o.selected = v.includes(o.value);
      else el.value = v;
    }
  }, [state]);
  useEffect(() => () => stop.current?.(), []);
  return { ref, onSubmit };
}

/** Run `fn` once each time an action's state comes back ok. A form that stays on screen after a success must close
 *  or be redrawn then: React resets a `<form action>` after a success too, which puts radios and selects back to
 *  how they were first drawn while React's state still holds the last choice — so a second add from the same open
 *  form would quietly send the defaults. Closing (or bumping the form's key and putting its state back) makes the
 *  DOM and the state start again together. Runs as an effect, so it may also call a parent's setter. */
export function useOnSuccess(state: object | null | undefined, fn: () => void) {
  const run = useEffectEvent(fn);
  const handled = useRef<object | null>(null);
  useEffect(() => {
    if (!state || !(state as { ok?: boolean }).ok || handled.current === state) return;
    handled.current = state;
    run();
  }, [state]);
}

/** A form that closes on success (or Cancel) unmounts the button that had focus, and focus falls to the page's
 *  top. `focusSoon()` puts it on `ref` — the row or button that is on screen once the form has gone — after that
 *  render has landed. */
export function useFocusSoon<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [asked, setAsked] = useState(0);
  useEffect(() => { if (asked) ref.current?.focus(); }, [asked]);
  return [ref, () => setAsked((n) => n + 1)] as const;
}
