'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '../Icon';
import { format } from '@/lib/money';
import { nth } from '@/lib/ordinal';
import { haptic } from '../haptics';
import { AccountForm, type Editable } from './EditAccount';
import { bankFor, bankFromName, networkFor } from '@/lib/card-brand';

/* The cards, as a wallet rather than a list.

   A card face carries four things and nothing else: whose card it is, what it
   owes, when that is due, and the last four digits small in a corner. The
   embossed number, the gold chip and the contactless mark went — they made a
   convincing plastic rectangle and told a person nothing they came to find
   out. The face is neutral in both themes so the bank's mark is the only
   colour on it, and the network is greyscale, because the bank says which
   card this is and Visa or Mastercard is a footnote.

   Cards run sideways, one to a screen with the next peeking, so a household
   with five of them scrolls no further than a household with one. The swipe
   is never the only way: the dots underneath are buttons, every card sits in
   the page in reading order, and each one carries its own Pay and Edit rather
   than depending on which is currently in view. */

export type CardInfo = {
  edit: Editable;
  /** Minor units, positive when the card owes money. */
  owed: number;
  limit: number | null;
  /** `dueOn` is date-only so it never shifts across browser time zones. */
  cycle: { charged: number; entries: number; dueOn: string } | null;
};

export default function CardDeck({ cards, canWrite }: { cards: CardInfo[]; canWrite: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const many = cards.length > 1;

  /* Which card is showing is read back from the track, not remembered from
     the tap, so a finger drag and a tap on a dot cannot disagree. */
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (el.scrollWidth / cards.length));
    if (i !== at && i >= 0 && i < cards.length) setAt(i);
  };
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    haptic('select');
    el.scrollTo({ left: (el.scrollWidth / cards.length) * i, behavior: 'smooth' });
    setAt(i);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
      <div ref={track} onScroll={onScroll} className="deck" style={{
        display: 'flex', gap: 12, overflowX: many ? 'auto' : 'hidden',
        scrollSnapType: 'x mandatory', padding: '0 var(--gutter) 4px',
      }}>
        {cards.map((card) => (
          <div key={card.edit.id} style={{
            flex: many ? '0 0 86%' : '1 1 100%', minWidth: 0, scrollSnapAlign: 'center',
          }}>
            <CardBlock card={card} canWrite={canWrite} />
          </div>
        ))}
      </div>

      {many && (
        <div role="group" aria-label="Which card" style={{ display: 'flex', justifyContent: 'center' }}>
          {cards.map((c, i) => (
            <button key={c.edit.id} type="button" onClick={() => go(i)}
              aria-label={`Show ${c.edit.name}`} aria-current={i === at}
              style={{
                width: 30, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}>
              <span aria-hidden style={{
                width: i === at ? 18 : 7, height: 7, borderRadius: 999,
                background: i === at ? 'var(--c-ink)' : 'var(--c-track2)',
                transition: 'width .18s, background .18s',
              }} />
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
  const payable = cycle?.charged || owed;
  const available = limit === null ? null : limit - owed;

  if (editing) {
    return (
      <section className="el card" style={{
        background: 'var(--c-card)', borderRadius: 20, padding: '0 var(--pad)', overflow: 'hidden',
      }}>
        <AccountForm account={account} onDone={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <CardFace card={card} />

      {available !== null && (
        <p style={{ margin: '0 2px', fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
          {available >= 0
            ? <><b className="n" style={{ color: 'var(--c-ink)', fontWeight: 700 }}>{format(available)}</b> of {format(limit!)} still available</>
            : <><b className="n" style={{ color: 'var(--c-danger)', fontWeight: 700 }}>{format(Math.abs(available))}</b> over the limit</>}
        </p>
      )}

      {canWrite && (
        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
          {payable > 0 && (
            <Link className="el cta" href={`/add?kind=transfer&to=${account.id}&amount=${payable}`}
              transitionTypes={['nav-forward']} onClick={() => haptic('select')}
              aria-label={`Pay ${format(payable)} to ${account.name}`}
              style={{
                flex: 1, minWidth: 0, minHeight: 46, borderRadius: 13, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 'var(--step--1)',
                fontWeight: 700, background: 'var(--g-primary)', color: 'var(--c-on-primary)',
                textDecoration: 'none',
              }}>
              <Icon name="move" size={17} strokeWidth={2} />
              Pay {format(payable)}
            </Link>
          )}
          <button type="button" onClick={() => { haptic('select'); setEditing(true); }}
            aria-label={`Edit ${account.name}`}
            style={{
              flex: payable > 0 ? 'none' : 1, minHeight: 46, padding: '0 16px', borderRadius: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)',
            }}>
            <Icon name="pencil" size={16} strokeWidth={2} />
            Edit
          </button>
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

  return (
    <section aria-label={`${account.name}, ${format(owed)} outstanding`} className="el" style={{
      /* Not the 1.586 of real plastic. That proportion is drawn around an
         embossed number and a chip; with those gone it is mostly empty
         middle, and a card that says four things should be the height of
         four things. */
      aspectRatio: '1.95 / 1', width: '100%', minWidth: 0, borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      background: 'var(--card-face)', border: '1px solid var(--card-edge)', color: 'var(--c-ink)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
        }}>
          {/* The one thing on the card wearing a colour. */}
          <span style={{
            height: 26, maxWidth: 104, flex: 'none', display: 'flex', alignItems: 'center',
            borderRadius: 5, padding: bank?.logo ? '3px 5px' : 0,
            background: bank?.logo ? 'var(--card-logo-bg)' : 'transparent',
            boxShadow: bank?.logo ? '0 0 0 1px var(--card-logo-edge)' : undefined,
          }}>
            {bank?.logo
              ? <Image src={bank.logo} alt={bank.label} width={104} height={26} unoptimized
                  style={{ display: 'block', width: 'auto', height: '100%', objectFit: 'contain' }} />
              : <span style={{
                  fontSize: 'var(--step--1)', fontWeight: 700, color: 'var(--c-meta)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{account.name}</span>}
          </span>
          {network?.logo && (
            <Image src={network.logo} alt={network.label} width={44} height={18} unoptimized
              style={{ display: 'block', width: 'auto', height: 15, objectFit: 'contain',
                       filter: 'var(--brand-grey)' }} />
          )}
        </span>
        {account.last4 && (
          <span className="n" aria-label={`ending ${account.last4}`} style={{
            flex: 'none', fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
            color: 'var(--c-meta)', paddingTop: 4,
          }}>••{account.last4}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
            color: 'var(--c-meta)',
          }}>{owed > 0 ? 'Outstanding' : 'Nothing owed'}</span>
          <span className="t n" style={{
            fontSize: 'clamp(23px, 7.2vw, 31px)', fontWeight: 700, letterSpacing: '-.025em',
            lineHeight: 1.02,
          }}>{format(owed)}</span>
        </span>
        {due && owed > 0 && (
          <span style={{
            flex: 'none', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
              color: 'var(--c-meta)',
            }}>Due</span>
            <span className="n" style={{
              fontSize: 'var(--step-0)', fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap',
            }}>{due}</span>
          </span>
        )}
      </div>
    </section>
  );
}
