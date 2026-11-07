'use client';

import { useActionState, useState } from 'react';
import { setTheme } from './actions';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import type { Theme } from '@/lib/theme';
import { applyTheme } from './apply-theme';
import { ErrorNote } from '../auth-ui';

const OPTIONS: { id: Theme; icon: string; label: string }[] = [
  { id: 'system', icon: 'phone', label: 'Phone' },
  { id: 'light', icon: 'sun', label: 'Light' },
  { id: 'dark', icon: 'moon', label: 'Dark' },
];

/* Three buttons in one form, each carrying its own value, so the choice is a
   single tap and works before the bundle has loaded. The page switches at
   once from the click handler — waiting for the round trip would make the
   tap feel ignored — and the action then writes the cookie that makes it
   stick on the next visit. */
export default function ThemePicker({ current }: { current: Theme }) {
  const [state, act, pending] = useActionState(setTheme, null);
  const [chosen, setChosen] = useState<Theme>(current);

  function pick(t: Theme) {
    haptic('select');
    setChosen(t);
    applyTheme(t);
  }

  return (
    <form action={act} className="flex flex-col gap-3 rounded-[20px] bg-card shadow-card p-[var(--pad)]">
      <div role="group" aria-label="Appearance" className="flex gap-1 rounded-[14px] bg-muted p-1">
        {OPTIONS.map((o) => {
          const on = chosen === o.id;
          return (
            <button key={o.id} type="submit" name="theme" value={o.id} aria-pressed={on}
              onClick={() => pick(o.id)} disabled={pending && on}
              className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-body font-semibold transition-colors ${on
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'}`}>
              <Icon name={o.icon} size={18} filled={on} />
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-subhead leading-snug text-muted-foreground">
        {chosen === 'system'
          ? 'Follows the phone: light by day, dark when it is.'
          : 'Set for this device only. Other phones keep their own choice.'}
      </p>
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
    </form>
  );
}
