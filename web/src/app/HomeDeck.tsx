'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { haptic } from './haptics';
import { useMoney } from '@/app/currency';

/* The top of the home screen, as a deck rather than a stack.

   Three things want to be the first thing you see and only one of them can
   be: this month against its budget, what the household is actually worth,
   and what is out on loan. They used to be one card and two tiles in a grid
   below the fold, which made the two in the grid feel like settings. Now
   they are one card you swipe, in that order, because the month is what most
   opens want and the other two are a flick away rather than a page away.

   Every card says its own name — This month, Net worth, Loan centre — in the
   same place and the same type. A deck where each card has a different shape
   and no label is a deck where a person has to work out what they are looking
   at every time they swipe.

   Same rules as the card wallet: the next card peeks so it is obvious there
   is one, the dots are buttons so the swipe is never the only way, and each
   card carries its own link so a screen reader reaches all three in order
   whatever is on screen. */

export type Point = { month: string; worth: string };

export default function HomeDeck({ children, worth, netWorth, lent, owedToYou, people, openLoans }: {
  /** The month card, rendered by the server: budget maths belongs there. */
  children: React.ReactNode;
  worth: Point[];
  netWorth: number;
  lent: number;
  owedToYou: number;
  people: number;
  openLoans: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const cards = 3;

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (el.scrollWidth / cards));
    if (i !== at && i >= 0 && i < cards) setAt(i);
  };
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    haptic('select');
    el.scrollTo({ left: (el.scrollWidth / cards) * i, behavior: 'smooth' });
    setAt(i);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div ref={track} onScroll={onScroll} className="deck" style={{
        display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory',
        padding: '0 var(--gutter) 4px', margin: '0 calc(var(--gutter) * -1)',
      }}>
        <Slide>{children}</Slide>
        <Slide><WorthCard worth={worth} netWorth={netWorth} owedToYou={owedToYou} /></Slide>
        <Slide><LoanCard lent={lent} owedToYou={owedToYou} people={people} openLoans={openLoans} /></Slide>
      </div>
      <div role="group" aria-label="Which card" style={{ display: 'flex', justifyContent: 'center' }}>
        {['This month', 'Net worth', 'Loan centre'].map((label, i) => (
          <button key={label} type="button" onClick={() => go(i)}
            aria-label={`Show ${label}`} aria-current={i === at}
            style={{
              width: 30, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0,
            }}>
            <span aria-hidden style={{
              width: i === at ? 18 : 7, height: 7, borderRadius: 999,
              background: i === at ? 'var(--c-ink)' : 'var(--c-track2)',
              transition: 'width .18s, background .18s',
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <div className="deck-slide" style={{ flex: '0 0 92%', minWidth: 0, scrollSnapAlign: 'center' }}>
      {children}
    </div>
  );
}

/* Six months of spending as bars, at a size that answers one question — is it
   going up? — and hands the rest to the Trends screen. */
function WorthCard({ worth, netWorth, owedToYou }: {
  worth: Point[]; netWorth: number; owedToYou: number;
}) {
  const { format } = useMoney();
  const vals = worth.map((p) => Number(p.worth));
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals);
  const span = hi - lo || 1;
  const first = vals[0] ?? 0;
  const move = netWorth - first;
  const initial = (m: string) =>
    new Date(`${m}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }).slice(0, 1);

  return (
    <Link href="/worth" transitionTypes={['nav-forward']} className="el2 press" style={{
      display: 'flex', flexDirection: 'column', gap: 13, borderRadius: 22, padding: '18px 17px',
      backgroundColor: 'var(--c-card)', backgroundImage: 'var(--g-deck-worth)',
      border: '1px solid var(--c-border)', color: 'var(--c-ink)', textDecoration: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 'var(--step-2)', fontWeight: 600 }}>Net worth</span>
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>Open ›</span>
      </span>

      <span className="t" style={{ fontSize: 'var(--step-4)', lineHeight: 1 }}>{format(netWorth)}</span>
      <span style={{ fontSize: 'var(--step--1)', marginTop: -6, color: 'var(--c-meta)' }}>
        {move === 0
          ? 'unchanged over six months'
          : <>
              <b className="n" style={{ color: move > 0 ? 'var(--c-in)' : 'var(--c-out)' }}>
                {move > 0 ? '+' : '−'}{format(Math.abs(move))}
              </b>{' '}over six months
            </>}
      </span>

      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 54, marginTop: 2 }}>
        {vals.map((v, i) => (
          <span key={worth[i]?.month ?? i} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            height: '100%', justifyContent: 'flex-end',
          }}>
            <span aria-hidden style={{
              width: '100%', height: `${Math.max(4, ((v - lo) / span) * 100)}%`, borderRadius: 4,
              background: i === vals.length - 1
                ? (v >= first ? 'var(--c-in)' : 'var(--c-out)')
                : 'var(--c-track2)',
            }} />
            <span aria-hidden style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-meta)' }}>
              {initial(worth[i]?.month ?? '')}
            </span>
          </span>
        ))}
      </span>

      <span style={{
        marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--c-rule)',
        fontSize: 'var(--step--1)', color: 'var(--c-meta)', lineHeight: 1.45,
      }}>
        {owedToYou > 0
          ? <>Everything you hold, {format(owedToYou)} of it still owed to you.</>
          : 'Everything you hold, less what is owed on the cards.'}
      </span>
    </Link>
  );
}

/* What is out on loan, and what is owed the other way. Money lent is not
   spending, so it never shows in the month card — which is exactly why it
   needs a card of its own rather than being invisible until somebody goes
   looking for it. */
function LoanCard({ lent, owedToYou, people, openLoans }: {
  lent: number; owedToYou: number; people: number; openLoans: number;
}) {
  const { format } = useMoney();
  const youOwe = lent < 0 ? -lent : 0;
  const out = owedToYou + Math.max(0, lent);

  return (
    <Link href="/people" transitionTypes={['nav-forward']} className="el2 press" style={{
      display: 'flex', flexDirection: 'column', gap: 13, borderRadius: 22, padding: '18px 17px',
      backgroundColor: 'var(--c-card)', backgroundImage: 'var(--g-deck-loan)',
      border: '1px solid var(--c-border)', color: 'var(--c-ink)', textDecoration: 'none',
    }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 'var(--step-2)', fontWeight: 600 }}>Loan centre</span>
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>Open ›</span>
      </span>

      <span className="t" style={{
        fontSize: 'var(--step-4)', lineHeight: 1, color: out > 0 ? 'var(--c-in)' : 'var(--c-ink)',
      }}>{format(out)}</span>
      <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)', marginTop: -6 }}>
        {out === 0
          ? 'owed to you — nothing outstanding'
          : `owed to you across ${openLoans} ${openLoans === 1 ? 'loan' : 'loans'}`}
      </span>

      <span style={{ display: 'flex', gap: 9, marginTop: 2 }}>
        <Fact label="People" value={String(people)} />
        <Fact label="You owe" value={youOwe > 0 ? format(youOwe) : '—'}
          tone={youOwe > 0 ? 'var(--c-out)' : undefined} />
      </span>

      <span style={{
        marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--c-rule)',
        fontSize: 'var(--step--1)', color: 'var(--c-meta)', lineHeight: 1.45,
      }}>
        Money lent is not spending — it sits here until it comes back.
      </span>
    </Link>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
      padding: '8px 11px', borderRadius: 11, background: 'var(--c-sunk2)',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
        textTransform: 'uppercase', color: 'var(--c-meta)',
      }}>{label}</span>
      <span className="t n" style={{ fontSize: 'var(--step-0)', fontWeight: 700, color: tone }}>
        {value}
      </span>
    </span>
  );
}
