'use client';

import { useState } from 'react';
import { Icon, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT, tintOf } from './Icon';
import { defaultRef, findRef, flatWays, isFlat, ownRail, viaRails, type Flat, type Way } from '@/lib/pay';
import { haptic } from './haptics';
import { choice } from './choice';

/* The one way to choose a way to pay, on every form that asks.

   It is one question — how did you pay? — and one flat list of answers in
   the words a person uses: "GPay", "the Amazon card", "cash", "ICICI
   directly". Underneath, GPay is a rail on a bank account and the card is an
   account of its own, and for a while the picker showed that: a row of
   accounts (a credit card beside a savings account, which reads as two kinds
   of thing on one row) and then a second row of "via" apps. Nobody thinks
   of paying that way. Now every concrete way is a tile with its own icon,
   its name in bold and, in small print, what stands behind it — the bank an
   app draws on, "Credit card", "Debit card or NEFT" — and one tap
   settles both the account and the rail the ledger writes. Tiles are grey
   until chosen, like every other choice in the app.                       */

/** A chip with room for its name: wraps into the next row rather than past
 *  the edge of the screen. */
export const CHIP: React.CSSProperties = {
  minHeight: 44, maxWidth: '100%', padding: '0 13px 0 10px', display: 'flex', alignItems: 'center',
  gap: 7, borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600,
  transition: 'background .15s, color .15s',
};
export const CHIP_TEXT: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

const KIND_WORDS: Record<string, string> = {
  cash: 'Cash in hand', spending: 'Bank account', savings: 'Savings account', credit: 'Credit card',
};

/** What to call one flat option: the icon, its name, and the small print. */
export function describe(opt: Flat): { icon: string; ink: string; title: string; sub: string } {
  const { way, rail } = opt;
  if (rail && rail !== ownRail(way)) {
    const [, ink] = tintOf(RAIL_TINT[rail.kind] ?? 'neutral');
    return { icon: RAIL_ICON[rail.kind] ?? 'wallet', ink, title: rail.name, sub: way.name };
  }
  const [, ink] = tintOf(ACCOUNT_TINT[way.kind] ?? 'neutral');
  const bank = way.kind === 'spending' || way.kind === 'savings';
  const sub = bank && viaRails(way).length > 0 ? 'Debit card or NEFT' : KIND_WORDS[way.kind] ?? '';
  return { icon: ACCOUNT_ICON[way.kind] ?? 'bank', ink, title: way.name, sub };
}

/** A name gets two lines before it is cut — "ICICI Amazon Pay" on a narrow
 *  phone is two words a person needs both of. */
const TWO_LINES: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
};

export const TILE: React.CSSProperties = {
  minHeight: 56, padding: '8px 10px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10,
  minWidth: 0, textAlign: 'left', transition: 'background .15s, color .15s',
};

/** One answer to "how did you pay?": icon, name, and what stands behind it. */
export function WayTile({ icon, ink, title, sub, on, onClick, disabled }: {
  icon: string; ink: string; title: string; sub?: string; on: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} disabled={disabled}
      style={{ ...TILE, ...choice(on, ink) }}>
      <span aria-hidden style={{
        width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: on ? 'color-mix(in srgb, currentColor 16%, transparent)' : 'var(--c-card)',
        color: on ? 'inherit' : 'var(--c-meta)',
      }}>
        <Icon name={icon} size={18} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 700, lineHeight: 1.2, ...TWO_LINES }}>{title}</span>
        {sub && (
          <span style={{
            fontSize: 'var(--step--2)', lineHeight: 1.2, fontWeight: 500,
            color: on ? 'inherit' : 'var(--c-meta)', opacity: on ? 0.82 : 1, ...TWO_LINES,
          }}>{sub}</span>
        )}
      </span>
    </button>
  );
}

export const TILE_GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8,
};

export default function PayPicker({ ways, value, onChange, name, defaultValue, disabled, label = 'How did you pay' }: {
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
  if (ways.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
        No accounts yet — add one under Accounts first.
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} style={{ ...TILE_GRID, opacity: disabled ? 0.6 : 1 }}>
      {name && <input type="hidden" name={name} value={cur} />}
      {flatWays(ways).map((opt) => {
        const d = describe(opt);
        return (
          <WayTile key={opt.ref} {...d} on={isFlat(hit, opt)} onClick={() => pick(opt.ref)} disabled={disabled} />
        );
      })}
    </div>
  );
}
