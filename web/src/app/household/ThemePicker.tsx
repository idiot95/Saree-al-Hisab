'use client';

import { useActionState, useState } from 'react';
import { setTheme } from './actions';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import type { Theme } from '@/lib/theme';
import { applyTheme } from './apply-theme';

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
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div role="group" aria-label="Appearance" style={{
        display: 'flex', gap: 5, padding: 5, borderRadius: 14, background: 'var(--c-sunk)',
      }}>
        {OPTIONS.map((o) => {
          const on = chosen === o.id;
          return (
            <button key={o.id} type="submit" name="theme" value={o.id} aria-pressed={on}
              onClick={() => pick(o.id)} disabled={pending && on} className="cta" style={{
                flex: 1, minHeight: 46, borderRadius: 10, fontSize: 'var(--step--1)', fontWeight: 600,
                background: on ? 'var(--c-card)' : 'transparent',
                color: on ? 'var(--c-ink)' : 'var(--c-meta)',
                boxShadow: on ? '0 1px 2px rgba(0,0,0,.10), 0 0 0 1px var(--c-border)' : 'none',
                transition: 'background .18s, color .18s, box-shadow .18s',
              }}>
              <Icon name={o.icon} size={17} strokeWidth={2} />
              {o.label}
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        {chosen === 'system'
          ? 'Follows the phone: light by day, dark when it is.'
          : 'Set for this device only. Other phones keep their own choice.'}
      </p>
      {state && !state.ok && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>{state.error}</p>
      )}
    </form>
  );
}
