/* One icon set for the whole app.

   Categories already carry an icon name in the database — 'cart', 'house2',
   'cutlery' — and every screen was throwing it away and drawing two letters
   instead. These are the glyphs those names mean.

   All 24×24, all stroked at the same weight, all drawn on the same optical
   grid, so a row of them reads as a set rather than a collection. Broad
   categories on purpose: one clear glyph for "eating out" beats six for
   restaurants, cafés, takeaway and the rest, which is why a wallet app can be
   scanned at a glance instead of read. */

export type IconName =
  // categories
  | 'house2' | 'cart' | 'child' | 'cutlery' | 'bag' | 'bulb' | 'car' | 'health'
  | 'phone' | 'gift' | 'plane' | 'fuel' | 'book' | 'coffee' | 'scissors'
  | 'tools' | 'pet' | 'gym' | 'music' | 'wifi' | 'shield' | 'charity'
  | 'salary' | 'invest' | 'tag'
  // accounts and rails
  | 'bank' | 'cash' | 'vault' | 'card' | 'person' | 'upi' | 'netbanking'
  | 'cheque' | 'wallet' | 'autodebit';

const P: Record<IconName, string> = {
  // ── categories ───────────────────────────────────────────────────────────
  house2: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM9.5 20.5v-6h5v6',
  cart: 'M3 4.5h2l2.2 9.5h9.4l2-6.5H6.4M9.5 19a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM16.5 19a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  child: 'M12 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM8 20.5v-4.2l-1.6-1.1 1.1-3.4A3 3 0 0 1 10.4 9.6h3.2a3 3 0 0 1 2.9 2.2l1.1 3.4-1.6 1.1v4.2',
  cutlery: 'M7 3.5v7a2 2 0 0 0 2 2v8M5 3.5v4M9 3.5v4M17 3.5c-1.6 0-2.5 2-2.5 4.5s.9 3.5 2.5 3.5v9',
  bag: 'M5 8h14l-1 12.5H6zM9 8V6.2a3 3 0 0 1 6 0V8',
  bulb: 'M9.5 17.5h5M10 20.5h4M9 14.5a5 5 0 1 1 6 0c-.6.5-1 1.2-1 2h-4c0-.8-.4-1.5-1-2z',
  car: 'M3.5 15.5h17M5.5 15.5 7 9.2A2 2 0 0 1 9 7.7h6a2 2 0 0 1 2 1.5l1.5 6.3M4 15.5v3M20 15.5v3M7.5 12h9',
  health: 'M12 20.5S4 15.6 4 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 2.2c0 5.4-8 10.3-8 10.3z',
  phone: 'M7.5 2.8h9a1.7 1.7 0 0 1 1.7 1.7v15a1.7 1.7 0 0 1-1.7 1.7h-9a1.7 1.7 0 0 1-1.7-1.7v-15a1.7 1.7 0 0 1 1.7-1.7zM10.5 18.3h3',
  gift: 'M3.8 9.5h16.4v3H3.8zM5.2 12.5v7A1.3 1.3 0 0 0 6.5 20.8h11a1.3 1.3 0 0 0 1.3-1.3v-7M12 9.5v11.3M12 9.5S10.8 4.5 8.4 4.5a2 2 0 0 0 0 5M12 9.5s1.2-5 3.6-5a2 2 0 0 1 0 5',
  plane: 'M10.3 20.5 12 15.8l5.8-1.6 3.4-3.4a1.7 1.7 0 0 0-2.4-2.4l-3.4 3.4-1.6 5.8M3.5 12.6l4-1.1 4.6-4.6-1.4-3.4 1.6-.9 3 3.3',
  fuel: 'M5 20.5V5.3A1.8 1.8 0 0 1 6.8 3.5h4.9a1.8 1.8 0 0 1 1.8 1.8v15.2M3.5 20.5h11.5M5 11h9.5M16.5 8.5l2.3 2.3v6.4a1.6 1.6 0 0 0 3.2 0V9.5l-2.5-2.5',
  book: 'M4.5 4.5h9a2.5 2.5 0 0 1 2.5 2.5v13a2 2 0 0 0-2-2h-9.5zM19.5 4.5h-3.5v15.5a2 2 0 0 1 2-2h1.5z',
  coffee: 'M4.5 8.5h12v6a4.5 4.5 0 0 1-9 0zM16.5 10h1.8a2.4 2.4 0 0 1 0 4.8h-1.8M4.5 20.5h12M8 5.2V3.5M12 5.2V3.5',
  scissors: 'M7 8.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM7 20.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM8.9 7 19 19M8.9 17 19 5',
  tools: 'M14.2 6.8a3.8 3.8 0 0 0 5 5l-8.6 8.6a2 2 0 0 1-2.9-2.9zM5 9.5 9.5 5M4 5.5 5.5 4l4 4-1.5 1.5z',
  pet: 'M7 8.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 8.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM4.5 14.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM19.5 14.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM12 20.5c-2.6 0-4.5-1.4-4.5-3.4S9.4 11.5 12 11.5s4.5 3.6 4.5 5.6-1.9 3.4-4.5 3.4z',
  gym: 'M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11',
  music: 'M9 18.2a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0zM20.5 15.7a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0zM9 18.2V6.2l11.5-2.4v11.9',
  wifi: 'M12 19.5v.01M8.6 15.6a5 5 0 0 1 6.8 0M5.4 12.2a9.6 9.6 0 0 1 13.2 0M2.5 8.9a14 14 0 0 1 19 0',
  shield: 'M12 3.5 20 6.5v6c0 4.4-3.4 7.3-8 8.5-4.6-1.2-8-4.1-8-8.5v-6z',
  charity: 'M12 20.3S4.5 15.6 4.5 10.4A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.5 2.2c0 5.2-7.5 9.9-7.5 9.9zM12 11v4M10 13h4',
  salary: 'M12 3.5v17M15.5 7H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8',
  invest: 'M4 18l5-5 3.5 3.5L20 8M15 8h5v5',
  tag: 'M3.5 11V4.5H10L20.5 15a1.6 1.6 0 0 1 0 2.3l-3.2 3.2a1.6 1.6 0 0 1-2.3 0zM7 8v.01',

  // ── accounts and the rails money travels on ─────────────────────────────
  bank: 'M3.5 9.5h17L12 4 3.5 9.5zM5.5 9.5v8M9.5 9.5v8M14.5 9.5v8M18.5 9.5v8M3 20.5h18',
  cash: 'M3.5 6.5h17v11h-17zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM6.6 6.5v.01M17.4 17.5v.01',
  vault: 'M12 3.5 20 8v8l-8 4.5L4 16V8zM4 8l8 4.5L20 8M12 12.5v8',
  card: 'M3.5 9.5h17M4.6 6.5h14.8a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 15.9V8.1a1.6 1.6 0 0 1 1.6-1.6zM6.5 14h3',
  person: 'M12 11.7a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8zM5 20.5a7 7 0 0 1 14 0',
  upi: 'M6 3.5 17 12 6 20.5zM12 3.5 20 12l-8 8.5',
  netbanking: 'M3.5 9.5h17L12 4 3.5 9.5zM6 9.5v8M12 9.5v8M18 9.5v8M3 20.5h18M9 13.5h6',
  cheque: 'M3.5 6.5h17v11h-17zM6.5 10h6M6.5 13h4M15 14.5l1.6 1.6 3-3.4',
  wallet: 'M4 7.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4zM4 7.5V6a1.5 1.5 0 0 1 1.5-1.5h10M16.5 13v.01',
  autodebit: 'M20 12a8 8 0 1 1-2.6-5.9M20.5 4v4h-4',
};

/** Category icon names that came from the seed but might not be in the set. */
const FALLBACK: IconName = 'tag';

export function Icon({ name, size = 19, strokeWidth = 1.7, ...rest }: {
  name: string | null | undefined; size?: number; strokeWidth?: number;
} & Omit<React.SVGProps<SVGSVGElement>, 'name'>) {
  const d = P[(name ?? '') as IconName] ?? P[FALLBACK];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden focusable="false" {...rest}>
      <path d={d} />
    </svg>
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

/** An icon in its tinted tile — the shape every list row in the app uses, so
 *  that categories, accounts and rails all read as the same kind of thing. */
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
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.48)} />
    </span>
  );
}

/** What an account kind looks like, so a card never reads like a bank. */
export const ACCOUNT_ICON: Record<string, IconName> = {
  spending: 'bank', cash: 'cash', savings: 'vault', credit: 'card', person: 'person',
};
export const ACCOUNT_TINT: Record<string, string> = {
  spending: 'blue', cash: 'green', savings: 'cyan', credit: 'orange', person: 'indigo',
};

/** And the rail money actually travels on. */
export const RAIL_ICON: Record<string, IconName> = {
  upi: 'upi', card: 'card', netbanking: 'netbanking', cash: 'cash',
  cheque: 'cheque', wallet: 'wallet', autodebit: 'autodebit',
};
