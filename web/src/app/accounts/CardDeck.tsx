'use client';

import { useEffect, useState } from 'react';
import Link from '@/app/NavLink';
import Image from 'next/image';
import { Icon } from '../Icon';
import { format } from '@/lib/money';
import { nth } from '@/lib/ordinal';
import { haptic } from '../haptics';
import { AccountForm, type Editable } from './EditAccount';
import { bankFor, bankFromName, networkFor } from '@/lib/card-brand';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

/* The cards, as a wallet rather than a list.

   A card face carries four things and nothing else: whose card it is, what it
   owes, when that is due, and the last four digits small in a corner. The
   embossed number, the gold chip and the contactless mark went — they made a
   convincing plastic rectangle and told a person nothing they came to find
   out. The face is neutral in both themes so the bank's mark is the only
   colour on it, and the network is greyscale, because the bank says which
   card this is and Visa or Mastercard is a footnote.

   Cards run sideways on shadcn's Carousel (Embla), one to a screen with the
   next peeking, so a household with five of them scrolls no further than a
   household with one. The swipe is never the only way: the arrow keys page it,
   the dots underneath are buttons ("Card 2 of 3"), every card sits in the page
   in reading order, and each one carries its own Pay and Edit rather than
   depending on which is currently in view. */

export type CardInfo = {
  edit: Editable;
  /** Minor units, positive when the card owes money. */
  owed: number;
  limit: number | null;
  /** `dueOn` is date-only so it never shifts across browser time zones. */
  cycle: { charged: number; entries: number; dueOn: string } | null;
};

export default function CardDeck({ cards, canWrite }: { cards: CardInfo[]; canWrite: boolean }) {
  const [api, setApi] = useState<CarouselApi>();
  const [at, setAt] = useState(0);
  const many = cards.length > 1;

  /* Which card is showing is read back from the carousel, not remembered from the tap, so a swipe, an arrow key
     and a tap on a dot cannot disagree. */
  useEffect(() => {
    if (!api) return;
    const on = () => setAt(api.selectedScrollSnap());
    api.on('select', on).on('reInit', on);
    return () => { api.off('select', on).off('reInit', on); };
  }, [api]);
  const go = (i: number) => { haptic('select'); api?.scrollTo(i); };

  return (
    <div className="mb-1.5 flex flex-col gap-2">
      <Carousel setApi={setApi} opts={{ align: 'start', watchDrag: many }} aria-label="Credit cards"
        className="px-[var(--gutter)]">
        <CarouselContent className="-ml-3 pb-1">
          {cards.map((card, i) => (
            <CarouselItem key={card.edit.id} aria-label={`Card ${i + 1} of ${cards.length}`}
              className={cn('flex pl-3', many ? 'basis-[86%]' : 'basis-full')}>
              <CardBlock card={card} canWrite={canWrite} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {many && (
        <div role="group" aria-label="Which card" className="flex justify-center">
          {cards.map((c, i) => (
            <button key={c.edit.id} type="button" onClick={() => go(i)}
              aria-label={`Card ${i + 1} of ${cards.length}`} aria-current={i === at ? 'true' : undefined}
              className="group flex size-11 items-center justify-center p-0 in-data-[platform=android]:size-12">
              <span aria-hidden className={cn('h-[7px] rounded-full transition-[width,background-color] duration-200',
                i === at ? 'w-[18px] bg-foreground' : 'w-[7px] bg-input')} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardBlock({ card, canWrite }: { card: CardInfo; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const { edit: account, owed, limit, cycle } = card;
  /* Paying the bill means the statemented total when a bill is building, and
     everything owed when one is not. Either way it opens the transfer form
     with the figure in place: a payment here is a real movement between two
     accounts, never a flag, which is why the balance can be trusted. */
  /* Never more than is owed: a cycle's charges can include what a part payment already cleared. */
  const payable = Math.min(cycle?.charged || owed, owed);
  const available = limit === null ? null : limit - owed;

  if (editing) {
    return (
      <section className="min-w-0 flex-1 overflow-hidden rounded-[20px] border border-border bg-card px-[var(--pad)]">
        <AccountForm account={account} onDone={() => setEditing(false)} />
      </section>
    );
  }

  const quiet = 'flex min-h-[46px] flex-none items-center justify-center gap-[7px] rounded-[13px] bg-muted text-sm font-semibold text-foreground no-underline';
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5">
      <CardFace card={card} />

      {available !== null && (
        <p className="mx-0.5 text-xs text-muted-foreground">
          {available >= 0
            ? <><b className="n font-bold text-foreground">{format(available)}</b> of {format(limit!)} still available</>
            : <><b className="n font-bold text-destructive">{format(Math.abs(available))}</b> over the limit</>}
        </p>
      )}

      {canWrite && (
        <div className="flex min-w-0 gap-2">
          {payable > 0 && (
            <Link className="cta flex min-h-[46px] min-w-0 flex-1 items-center justify-center gap-[7px] rounded-[13px] bg-primary text-sm font-bold text-primary-foreground no-underline"
              href={`/add?kind=transfer&to=${account.id}&amount=${payable}`}
              transitionTypes={['nav-forward']} onClick={() => haptic('select')}
              aria-label={`Pay ${format(payable)} to ${account.name}`}>
              <Icon name="move" size={17} />
              Pay {format(payable)}
            </Link>
          )}
          <button type="button" onClick={() => { haptic('select'); setEditing(true); }}
            aria-label={`Edit ${account.name}`} className={cn(quiet, 'px-4', payable <= 0 && 'flex-1')}>
            <Icon name="pencil" size={16} />
            Edit
          </button>
          <Link href={`/accounts/${account.id}/reconcile`} transitionTypes={['nav-forward']}
            aria-label={`Reconcile ${account.name} with its statement`} className={cn(quiet, 'px-3.5')}>
            <Icon name="check" size={16} />
            Match
          </Link>
        </div>
      )}
    </div>
  );
}

function CardFace({ card }: { card: CardInfo }) {
  const { edit: account, owed, cycle } = card;
  const bank = bankFor(account.bank_key) ?? bankFromName(account.name);
  const network = networkFor(account.card_network);
  const due = cycle
    ? new Date(`${cycle.dueOn}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : account.due_day ? `the ${nth(account.due_day)}` : null;

  /* Not the 1.586 of real plastic. That proportion is drawn around an embossed number and a chip; with those gone
     it is mostly empty middle, and a card that says four things should be the height of four things. */
  return (
    <section aria-label={`${account.name}, ${format(owed)} outstanding`}
      className="flex aspect-[1.95/1] w-full min-w-0 flex-col justify-between rounded-[18px] border border-[var(--card-edge)] bg-[var(--card-face)] p-4 text-foreground">
      <div className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-[9px]">
          {/* The one thing on the card wearing a colour. */}
          <span className={cn('flex h-[26px] max-w-[104px] flex-none items-center rounded-[5px]',
            bank?.logo && 'bg-[var(--card-logo-bg)] px-[5px] py-[3px] shadow-[0_0_0_1px_var(--card-logo-edge)]')}>
            {bank?.logo
              ? <Image src={bank.logo} alt={bank.label} width={104} height={26} unoptimized
                  className="block h-full w-auto object-contain" />
              : <span className="truncate text-sm font-bold text-muted-foreground">{account.name}</span>}
          </span>
          {network?.logo && (
            <Image src={network.logo} alt={network.label} width={44} height={18} unoptimized
              className="block h-[15px] w-auto object-contain [filter:var(--brand-grey)]" />
          )}
        </span>
        {account.last4 && (
          <span className="n flex-none pt-1 text-[10px] font-semibold tracking-[.08em] text-muted-foreground"
            aria-label={`ending ${account.last4}`}>••{account.last4}</span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[9px] font-bold tracking-[.11em] text-muted-foreground uppercase">
            {owed > 0 ? 'Outstanding' : 'Nothing owed'}
          </span>
          <span className="t n text-[clamp(23px,7.2vw,31px)] leading-[1.02] font-bold tracking-[-.025em]">{format(owed)}</span>
        </span>
        {due && owed > 0 && (
          <span className="flex flex-none flex-col gap-0.5 text-right">
            <span className="text-[9px] font-bold tracking-[.11em] text-muted-foreground uppercase">Due</span>
            <span className="n text-base leading-[1.1] font-bold whitespace-nowrap">{due}</span>
          </span>
        )}
      </div>
    </section>
  );
}
