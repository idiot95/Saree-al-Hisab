import { ICON_NAMES, MATERIAL_USED } from './icon-names';

/* Material Symbols Rounded, self-hosted as a subset (src/app/fonts, built by
   scripts/icons-font.mjs) and drawn by ligature: the span's text is the glyph
   name, which is why it is aria-hidden unless it carries a label.

   Call sites still ask for 'cart' and get whatever the set calls a trolley:
   categories store the app name in the database, so ICON_NAMES maps it. A name
   the app does not know falls back to a tag rather than an empty box — a
   household may name a category anything, and a gap in a row is worse than a
   generic mark. Names the interface uses directly ('chevron_right') are
   accepted as they are. */

const MATERIAL = new Set(MATERIAL_USED);

export function Icon({ name, size = 20, filled = false, className, 'aria-label': label }: {
  name: string | null | undefined; size?: number; filled?: boolean; className?: string;
  'aria-label'?: string;
}) {
  const glyph = (name && ICON_NAMES[name]) || (name && MATERIAL.has(name) ? name : 'sell');
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={`inline-block shrink-0 select-none overflow-hidden whitespace-nowrap font-[family-name:var(--font-icons)] leading-none [font-feature-settings:'liga'] ${className ?? ''}`}
      style={{
        fontSize: size, width: size, height: size, ...(filled ? { fontVariationSettings: "'FILL' 1" } : null),
      }}
    >
      {glyph}
    </span>
  );
}

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
  neutral: ['var(--cat-neutral)', 'var(--cat-neutral-ink)'],
};

export function tintOf(tint: string | null | undefined): [string, string] {
  return TINT[tint ?? 'neutral'] ?? TINT.neutral;
}

/** An icon in its tinted tile — the shape every list row uses, so categories,
 *  accounts and rails all read as the same kind of thing. */
export function Chip({ icon, tint, size = 40, radius = 11, iconSize }: {
  icon: string | null | undefined; tint?: string | null;
  size?: number; radius?: number; iconSize?: number;
}) {
  const [bg, ink] = tintOf(tint);
  return (
    <span style={{
      width: size, height: size, flex: 'none', borderRadius: radius, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: bg, color: ink,
    }}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} />
    </span>
  );
}

/** What an account kind looks like, so a card never reads like a bank. */
export const ACCOUNT_ICON: Record<string, string> = {
  spending: 'bank', cash: 'cash', savings: 'savings', credit: 'card', person: 'person',
};
export const ACCOUNT_TINT: Record<string, string> = {
  spending: 'blue', cash: 'green', savings: 'cyan', credit: 'orange', person: 'indigo',
};

export const RAIL_ICON: Record<string, string> = {
  upi: 'upi', card: 'card', netbanking: 'netbanking', cash: 'cash',
  cheque: 'cheque', wallet: 'wallet', autodebit: 'autodebit',
};
export const RAIL_TINT: Record<string, string> = {
  upi: 'purple', card: 'orange', netbanking: 'blue', cash: 'green',
  cheque: 'neutral', wallet: 'pink', autodebit: 'indigo',
};
