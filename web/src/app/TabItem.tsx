import { Icon } from './Icon';
import type { Tab } from './tabs';

/* The drawing of the bar, shared by the live TabBar and the loading skeletons' still copy, so the two are one
   picture. No 'use client', no state, no handlers: a server component can render it, which is what keeps the
   still bar free of script chunks the CSP nonce cannot reach.

   Anchored: the bar must not slide with the content during a page transition, so it carries its own
   view-transition name. */
export const BAR_CLASS =
  'fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--tab-bar)+env(safe-area-inset-bottom,0px))] items-center border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]';

/** One slot: a fifth of the bar, the whole height of it, so the target is generous. */
export function slotClass(on: boolean) {
  return `relative flex h-full flex-1 flex-col items-center justify-center gap-1 no-underline ${on ? 'text-primary' : 'text-muted-foreground'}`;
}

/* Add: the one rose-gold, filled tile — 48px in iOS's 64px bar, 52 in Android's 80 — the biggest target in the bar and
   the only coloured one. Its edge is firmed with a ring in its own ink, so the tile holds its shape on a bright
   screen (rose gold on the card is 2:1; the + inside carries the meaning at 8:1, ux-audit O24). */
export const ADD_TILE_CLASS =
  'grid size-12 place-items-center rounded-2xl bg-attention text-attention-foreground shadow-sm ring-1 ring-attention-ink/30 in-data-[platform=android]:size-[52px]';

/** The inside of an ordinary tab. Android lights a pill (56×30) behind a filled icon; iOS fills the icon and
 *  tints the label. Shape as well as colour, so it survives a bright screen and colour blindness. */
export function TabFace({ t, on, here, live = false }: { t: Tab; on: boolean; here: boolean; live?: boolean }) {
  return (
    <>
      <span className={`${live && here ? 'tab-here ' : ''}grid h-[30px] w-14 place-items-center rounded-full ${
        on ? 'in-data-[platform=android]:bg-accent in-data-[platform=android]:text-accent-foreground' : ''}`}>
        <Icon name={t.icon} size={24} filled={on} />
      </span>
      <span className={`text-caption tracking-[.01em] ${on ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
    </>
  );
}
