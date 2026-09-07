import {
  IconHome2, IconShoppingCart, IconBabyCarriage, IconToolsKitchen2, IconShoppingBag,
  IconBulb, IconCar, IconHeartbeat, IconDeviceMobile, IconGift, IconPlane, IconGasStation,
  IconBook, IconCoffee, IconScissors, IconTools, IconPaw, IconBarbell, IconMusic, IconWifi,
  IconShieldCheck, IconHeartHandshake, IconCashBanknote, IconTrendingUp, IconTag,
  IconBuildingBank, IconCash, IconPigMoney, IconCreditCard, IconUser, IconQrcode,
  IconDeviceLaptop, IconWallet, IconRepeat, IconReceipt, IconSettings,
  type Icon as TablerIcon,
} from '@tabler/icons-react';

/* Tabler Icons (MIT), imported by name so only what is used is bundled.

   Drawing them by hand was a false economy: a set somebody maintains is more
   consistent than one I invent glyph by glyph, and it grows when a household
   wants a category nobody thought of. The wrapper stays, so every call site
   still asks for 'cart' and gets whatever the set calls a trolley.

   Broad categories on purpose, which is what makes a wallet app scannable: one
   clear glyph for "eating out" beats six for restaurants, cafés and takeaway. */

const SET: Record<string, TablerIcon> = {
  // ── categories ───────────────────────────────────────────────────────────
  house2: IconHome2,
  cart: IconShoppingCart,
  child: IconBabyCarriage,
  cutlery: IconToolsKitchen2,
  bag: IconShoppingBag,
  bulb: IconBulb,
  car: IconCar,
  health: IconHeartbeat,
  phone: IconDeviceMobile,
  gift: IconGift,
  plane: IconPlane,
  fuel: IconGasStation,
  book: IconBook,
  coffee: IconCoffee,
  scissors: IconScissors,
  tools: IconTools,
  pet: IconPaw,
  gym: IconBarbell,
  music: IconMusic,
  wifi: IconWifi,
  shield: IconShieldCheck,
  charity: IconHeartHandshake,
  salary: IconCashBanknote,
  invest: IconTrendingUp,
  tag: IconTag,

  // ── accounts, and the rails money travels on ────────────────────────────
  bank: IconBuildingBank,
  cash: IconCash,
  vault: IconPigMoney,
  card: IconCreditCard,
  person: IconUser,
  upi: IconQrcode,
  netbanking: IconDeviceLaptop,
  cheque: IconReceipt,
  wallet: IconWallet,
  autodebit: IconRepeat,
  settings: IconSettings,
};

export function Icon({ name, size = 19, strokeWidth = 1.8, ...rest }: {
  name: string | null | undefined; size?: number; strokeWidth?: number;
} & Omit<React.ComponentProps<TablerIcon>, 'name' | 'size' | 'strokeWidth'>) {
  // An unknown name gets a tag rather than an empty box — a household may name
  // a category anything, and a gap in a row is worse than a generic mark.
  const Glyph = SET[name ?? ''] ?? IconTag;
  return <Glyph size={size} stroke={strokeWidth} aria-hidden {...rest} />;
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
  spending: 'bank', cash: 'cash', savings: 'vault', credit: 'card', person: 'person',
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
