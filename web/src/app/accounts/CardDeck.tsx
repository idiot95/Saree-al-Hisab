'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../Icon';
import { format } from '@/lib/money';
import { nth } from '@/lib/ordinal';
import { haptic } from '../haptics';
import { headerBg } from '../auth-ui';
import { AccountForm, type Editable } from './EditAccount';

/* The cards, drawn as cards.

   A credit card was a row in a list like any other, which is honest and
   forgettable: the one number that matters — what it owes — sat in the same
   type as a savings balance. A card in a wallet does not look like that. So
   each one gets a face: the name, the last four digits, and the outstanding
   figure large on a dark ground, the app's pumpkin, which is the colour it
   uses for money owed everywhere else. Under the face is what a person
   actually wants next — how much of the limit is gone, when the bill lands
   and when it is due, and the button that pays it.

   With more than one card the faces become a deck you swipe through, a card
   at a time, with the next one peeking at the edge so it is obvious there is
   another. The swipe is the quick way, never the only way: the dots beneath
   are buttons, so the deck can be worked entirely by tapping, and every card
   is in the page in reading order for a screen reader whatever is on
   screen. */

export type CardInfo = {
  edit: Editable;
  /** Minor units, positive when the card owes money. */
  owed: number;
  limit: number | null;
  /** The bill building up now: what is on it, from how many entries, due when. */
  /** `dueOn` is date-only: a bill due on the 12th must not become the 11th in
   *  a browser west of UTC. */
  cycle: { charged: number; entries: number; dueOn: string } | null;
};

export default function CardDeck({ cards, canWrite }: { cards: CardInfo[]; canWrite: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const many = cards.length > 1;

  /* Which card is showing, worked out from where the track has been scrolled
     rather than from the swipe itself, so a tap on a dot and a drag of a
     finger end up in exactly the same state. */
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div ref={track} onScroll={onScroll} className="deck"
        style={{
          display: 'flex', gap: 12, overflowX: many ? 'auto' : 'visible',
          scrollSnapType: 'x mandatory', scrollPadding: '0 var(--gutter)',
          padding: '0 var(--gutter) 2px', margin: '0 calc(var(--gutter) * -1)',
        }}>
        {cards.map((c) => (
          <div key={c.edit.id} style={{
            flex: many ? '0 0 88%' : '1 1 100%', minWidth: 0, scrollSnapAlign: 'center',
          }}>
            <CardPanel card={c} canWrite={canWrite} />
          </div>
        ))}
      </div>

      {many && (
        <div role="group" aria-label="Which card" style={{
          display: 'flex', justifyContent: 'center', gap: 2,
        }}>
          {cards.map((c, i) => (
            <button key={c.edit.id} type="button" onClick={() => go(i)}
              aria-label={`Show ${c.edit.name}`} aria-current={i === at}
              style={{
                width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <span aria-hidden style={{
                width: i === at ? 20 : 7, height: 7, borderRadius: 999,
                background: i === at ? 'var(--c-pumpkin-hi)' : 'var(--c-track2)',
                transition: 'width .18s, background .18s',
              }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardPanel({ card, canWrite }: { card: CardInfo; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const { edit: a, owed, limit, cycle } = card;
  const used = limit ? Math.min(1, owed / limit) : 0;
  const available = limit === null ? null : limit - owed;
  /* What paying the bill means: the statemented total if a bill is building,
     otherwise everything the card owes. Either way it opens the transfer form
     with the figure filled in — the payment is a real transfer between two
     accounts here, not a status flag, which is why the balance can be trusted. */
  const payable = cycle?.charged || owed;

  if (editing) {
    return (
      <section className="el card" style={{
        background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
      }}>
        <AccountForm account={a} onDone={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <section className="el card" aria-label={a.name} style={{
      background: 'var(--c-card)', borderRadius: 18, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* The face */}
      <div style={{
        background: headerBg('pumpkin'), color: '#fff', padding: '15px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', overflow: 'hidden',
      }}>
        <span aria-hidden style={{
          position: 'absolute', right: -14, bottom: -20, opacity: 0.14, lineHeight: 0,
        }}>
          <Icon name="card" size={116} strokeWidth={1.1} />
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 'var(--step-0)', fontWeight: 700, letterSpacing: '-.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{a.name}</span>
          {a.last4 && (
            <span className="t" style={{
              fontSize: 'var(--step--1)', fontWeight: 600, color: 'rgba(255,255,255,.82)', flex: 'none',
            }}>•••• {a.last4}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="t" style={{
            fontSize: 'var(--step-3)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.1,
          }}>{format(owed)}</span>
          <span style={{
            fontSize: 'var(--step--2)', fontWeight: 600, letterSpacing: '.06em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.78)',
          }}>{owed > 0 ? 'Outstanding' : 'Nothing owed'}</span>
        </div>
      </div>

      <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {limit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span aria-hidden style={{
              height: 7, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden',
            }}>
              <span style={{
                display: 'block', height: '100%', borderRadius: 999, width: `${used * 100}%`,
                background: used > 0.8 ? 'var(--c-danger-fill)'
                  : used > 0.5 ? 'var(--c-warn-fill)' : 'var(--c-ok-fill)',
              }} />
            </span>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              {available !== null && available >= 0
                ? `${format(available)} of ${format(limit)} still available`
                : `${format(Math.abs(available ?? 0))} over the ${format(limit)} limit`}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Fact label="Bill due" value={
            cycle
              ? new Date(`${cycle.dueOn}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : a.due_day ? `the ${nth(a.due_day)}` : '—'
          } />
          <Fact label="Statement on" value={a.statement_day ? `the ${nth(a.statement_day)}` : '—'} />
        </div>

        <p style={{
          margin: 0, padding: '10px 12px', borderRadius: 11, background: 'var(--c-sunk2)',
          fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)',
        }}>
          {cycle ? (
            <>
              <b style={{ color: 'var(--c-ink)' }}>{format(cycle.charged)}</b>
              {' '}on this bill from {cycle.entries} {cycle.entries === 1 ? 'entry' : 'entries'}.
            </>
          ) : (
            <>Nothing on this bill yet.</>
          )}
        </p>

        {canWrite && (
          <div style={{ display: 'flex', gap: 9 }}>
            {payable > 0 && (
              <Link className="el cta" href={`/add?kind=transfer&to=${a.id}&amount=${payable}`}
                transitionTypes={['nav-forward']} onClick={() => haptic('select')}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 7, fontSize: 'var(--step--1)', fontWeight: 700,
                  background: 'var(--g-primary)', color: 'var(--c-on-primary)', textDecoration: 'none',
                }}>
                <Icon name="move" size={17} strokeWidth={2} />
                Pay {format(payable)}
              </Link>
            )}
            <button type="button" onClick={() => { haptic('select'); setEditing(true); }}
              style={{
                flex: payable > 0 ? 'none' : 1, minHeight: 46, padding: '0 16px', borderRadius: 12,
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
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
      padding: '9px 11px', borderRadius: 11, background: 'var(--c-sunk2)',
    }}>
      <span style={{
        fontSize: 'var(--step--2)', fontWeight: 600, letterSpacing: '.05em',
        textTransform: 'uppercase', color: 'var(--c-meta)',
      }}>{label}</span>
      <span className="t" style={{ fontSize: 'var(--step-0)', fontWeight: 700 }}>{value}</span>
    </span>
  );
}
