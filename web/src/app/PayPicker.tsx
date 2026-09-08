'use client';

import { useState } from 'react';
import { Icon, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT, tintOf } from './Icon';
import { defaultRef, findRef, pickWay, refOf, viaRails, type Way } from '@/lib/pay';
import { haptic } from './haptics';
import { choice } from './choice';

/* The one way to choose a way to pay, on every form that asks.

   It used to be chips on the Add screen and a <select> everywhere else, and
   the select was wrong in a way that took a real phone to see: iOS draws an
   <optgroup> as a heading and its first <option> as a row, so an account
   with a rail under it read as "ICICI Amazon Pay" twice, one under the
   other. The same picker everywhere means one thing to learn, and the
   answer — the account, and how it was drawn on — is visible at a glance
   instead of buried in a wheel. */

/** A chip with room for its name: wraps into the next row rather than past
 *  the edge of the screen. */
export const CHIP: React.CSSProperties = {
  minHeight: 44, maxWidth: '100%', padding: '0 13px 0 10px', display: 'flex', alignItems: 'center',
  gap: 7, borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600,
  transition: 'background .15s, color .15s',
};
export const CHIP_TEXT: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
/* Every account as a chip; under the chosen one, the rails that draw on it,
   plus "Directly" for money that left the account with no app in between.
   Tapping an account lands on its usual rail — the one marked default, or
   its only one — so the common case is one tap, and the account with no rail
   at all is simply itself. A rail named after its account (the card on the
   card) is the account and is not offered twice. */
export default function PayPicker({ ways, value, onChange, name, defaultValue, disabled, label = 'Which account' }: {
  ways: Way[];
  /** Controlled: the reference chosen, and what to do with the next one … */
  value?: string; onChange?: (ref: string) => void;
  /** … or standing in a plain form: the field it fills, and what it opens on. */
  name?: string; defaultValue?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [own, setOwn] = useState(() => defaultValue ?? defaultRef(ways));
  const cur = value ?? own;
  const pick = (ref: string) => { if (disabled) return; haptic('select'); setOwn(ref); onChange?.(ref); };
  const hit = findRef(ways, cur);
  const way = hit?.way ?? null;
  const via = way ? viaRails(way) : [];
  if (ways.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
        No accounts yet — add one under Accounts first.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: disabled ? 0.6 : 1 }}>
      {name && <input type="hidden" name={name} value={cur} />}
      <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ways.map((w) => {
          const on = w.id === way?.id;
          const [, ink] = tintOf(ACCOUNT_TINT[w.kind]);
          return (
            <button key={w.id} type="button" role="radio" aria-checked={on}
              onClick={() => pick(pickWay(w))} disabled={disabled}
              style={{ ...CHIP, ...choice(on, ink) }}>
              <Icon name={ACCOUNT_ICON[w.kind] ?? 'bank'} size={17} strokeWidth={1.9} />
              <span style={CHIP_TEXT}>{w.name}</span>
            </button>
          );
        })}
      </div>
      {way && via.length > 0 && (
        <div role="radiogroup" aria-label={`How, from ${way.name}`}
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)', padding: '0 4px 0 2px' }}>
            via
          </span>
          {via.map((r) => {
            const on = hit?.rail?.id === r.id;
            const [, ink] = tintOf(RAIL_TINT[r.kind]);
            return (
              <button key={r.id} type="button" role="radio" aria-checked={on}
                onClick={() => pick(refOf(way, r))} disabled={disabled}
                style={{
                  ...CHIP, minHeight: 40, padding: '0 11px 0 9px', fontSize: 'var(--step--2)',
                  ...choice(on, ink),
                }}>
                <Icon name={RAIL_ICON[r.kind] ?? 'wallet'} size={15} strokeWidth={1.9} />
                <span style={CHIP_TEXT}>{r.name}</span>
              </button>
            );
          })}
          {(() => {
            const on = !!hit && (hit.rail === null || !via.some((r) => r.id === hit.rail?.id));
            return (
              <button type="button" role="radio" aria-checked={on}
                onClick={() => pick(refOf(way, way.rails.find((r) => !via.includes(r)) ?? null))} disabled={disabled}
                style={{
                  ...CHIP, minHeight: 40, padding: '0 11px', fontSize: 'var(--step--2)',
                  ...choice(on, 'var(--c-ink)'), color: on ? 'var(--c-bg)' : 'var(--c-meta)',
                }}>
                Directly
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}

