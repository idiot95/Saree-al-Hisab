'use client';

import { useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Icon, ACCOUNT_ICON } from '../Icon';
import PayPicker, { WayTile, describe } from '../PayPicker';
import { MonthGrid } from '../DatePick';
import { findRef, payLabel, type Way } from '@/lib/pay';
import { friendlyDay, shiftDay } from '@/lib/recur';
import { formatHijri, toHijri } from '@/lib/hijri';
import { haptic } from '../haptics';
import { cn } from '@/lib/utils';

/* The answers that nearly always stay as they are — how it was paid, which day, where a move lands — as one row
   each that says the current answer and opens a drawer to change it. The full choices (every way to pay as a
   tile, the month grid) are a tap away instead of a screen's height of scrolling between the amount and Save. */

/** A vaul drawer holding one question. Over the Add drawer or the full page alike. */
export function PickDrawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={false}>
      <DrawerContent className="max-h-[88dvh] bg-background">
        <DrawerTitle className="px-4 pt-3 pb-2 text-base font-semibold">{title}</DrawerTitle>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** One row of the stack: icon, what it is, the answer, and a chevron. */
export function Row({ icon, caption, value, tag, onClick, muted = false, expanded, controls, id }: {
  icon: React.ReactNode; caption?: string; value: React.ReactNode; tag?: string; onClick: () => void;
  muted?: boolean; expanded?: boolean; controls?: string; id?: string;
}) {
  return (
    <button type="button" id={id} onClick={() => { haptic('tap'); onClick(); }}
      aria-expanded={expanded} aria-controls={controls} aria-haspopup={expanded === undefined ? 'dialog' : undefined}
      className={cn('flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left',
        muted ? 'text-muted-foreground' : 'text-foreground')}>
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        {caption && <span className="text-xs font-medium text-muted-foreground">{caption}</span>}
        <span className="truncate text-[15px] font-medium">{value}</span>
      </span>
      {tag && <span className="shrink-0 text-xs text-muted-foreground">{tag}</span>}
      <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} className="text-muted-foreground" />
    </button>
  );
}

/** How it was paid (or came in, or left from): the current way, opening every way as tiles. */
export function PayRow({ ways, value, onChange, caption, title, tag }: {
  ways: Way[]; value: string; onChange: (ref: string) => void; caption: string; title: string; tag?: string;
}) {
  const [open, setOpen] = useState(false);
  const hit = findRef(ways, value);
  const d = hit ? describe({ ref: value, way: hit.way, rail: hit.rail }) : null;
  return (
    <>
      <Row icon={<Icon name={d?.icon ?? 'wallet'} size={22} />} caption={caption}
        value={hit ? payLabel(hit.way, hit.rail) : 'Choose'} tag={tag} onClick={() => setOpen(true)} />
      <PickDrawer open={open} onClose={() => setOpen(false)} title={title}>
        <PayPicker ways={ways} value={value} label={title}
          onChange={(ref) => { onChange(ref); setOpen(false); }} />
      </PickDrawer>
    </>
  );
}

/** Where a move lands: every account but the one it leaves. */
export function ToRow({ ways, from, value, onChange }: {
  ways: Way[]; from: string | undefined; value: string | null; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const to = ways.find((w) => w.id === value);
  return (
    <>
      <Row icon={<Icon name={to ? ACCOUNT_ICON[to.kind] ?? 'bank' : 'move'} size={22} />} caption="To"
        value={to ? to.name : 'Choose an account'} muted={!to} onClick={() => setOpen(true)} />
      <PickDrawer open={open} onClose={() => setOpen(false)} title="To which account">
        <div role="radiogroup" aria-label="To which account" className="grid grid-cols-2 gap-2">
          {ways.filter((a) => a.id !== from).map((a) => (
            <WayTile key={a.id} {...describe({ ref: '', way: a, rail: null })} on={a.id === value}
              onClick={() => { haptic('select'); onChange(a.id); setOpen(false); }} />
          ))}
        </div>
      </PickDrawer>
    </>
  );
}

const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };

/** Which day: Today unless said otherwise, never a day ahead. The drawer has the four likely days as chips and
 *  the month grid (English and Hijri) beneath, so any other day is one more tap, not another drawer. */
export function WhenRow({ value, onChange, today }: {
  value: string; onChange: (iso: string) => void; today: string;
}) {
  const [open, setOpen] = useState(false);
  const quick = [0, 1, 2, 3].map((i) => shiftDay(today, -i));
  const pick = (iso: string) => { haptic('select'); onChange(iso); setOpen(false); };
  return (
    <>
      <Row icon={<Icon name="calendar_month" size={22} />} caption="When" value={friendlyDay(value, today)}
        onClick={() => setOpen(true)} />
      <PickDrawer open={open} onClose={() => setOpen(false)} title="Which day was it">
        <div role="radiogroup" aria-label="Which day was it" className="mb-3 flex flex-wrap gap-2">
          {quick.map((iso) => {
            const on = iso === value;
            return (
              <button key={iso} type="button" role="radio" aria-checked={on} onClick={() => pick(iso)}
                className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')}>
                {friendlyDay(iso, today)}
              </button>
            );
          })}
        </div>
        <MonthGrid value={value} today={today} max={today} onPick={pick} />
        <p className="mt-2.5 mb-1 text-xs leading-snug text-muted-foreground">
          Chosen: {friendlyDay(value, today)} · {formatHijri(toHijri(civil(value)), true)}
        </p>
      </PickDrawer>
    </>
  );
}
