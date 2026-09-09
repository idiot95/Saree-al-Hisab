'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { haptic } from './haptics';
import { useMoney } from '@/app/currency';

/* The top of the home screen, as a deck rather than a stack.

   Three things want to be the first thing you see and only one of them can
   be: this month against its budget, where the six months are heading, and
   what is out on loan. They used to be one card and two tiles in a grid
   below the fold, which made the two in the grid feel like settings. Now
   they are one card you swipe, in that order, because the month is what most
   opens want and the other two are a flick away rather than a page away.

   Same rules as the card wallet: the next card peeks so it is obvious there
   is one, the dots are buttons so the swipe is never the only way, and each
   card carries its own link so a screen reader reaches all three in order
   whatever is on screen. */

export type Trend = { month: string; spent: string };

export default function HomeDeck({ children, trend, lent, owedToYou }: {
  /** The month card, rendered by the server: budget maths belongs there. */
  children: React.ReactNode;
  trend: Trend[];
  lent: number;
  owedToYou: number;
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
        <Slide><TrendCard trend={trend} /></Slide>
        <Slide><LoanCard lent={lent} owedToYou={owedToYou} /></Slide>
      </div>
      <div role="group" aria-label="Which card" style={{ display: 'flex', justifyContent: 'center' }}>
        {['This month', 'Trends', 'Loans'].map((label, i) => (
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
    <div style={{ flex: '0 0 92%', minWidth: 0, scrollSnapAlign: 'center' }}>{children}</div>
  );
}

/* Six months of spending as bars, at a size that answers one question — is it
   going up? — and hands the rest to the Trends screen. */
function TrendCard({ trend }: { trend: Trend[] }) {
  const { format } = useMoney();
  const vals = trend.map((t) => Number(t.spent));
  const peak = Math.max(1, ...vals);
  const last = vals[vals.length - 1] ?? 0;
  const prev = vals[vals.length - 2] ?? 0;
  const change = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;

  return (
    <Link href="/trends" transitionTypes={['nav-forward']} className="el2 press" style={{
      display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 22, padding: '18px 17px',
      background: 'var(--c-card)', border: '1px solid var(--c-border)',
      color: 'var(--c-ink)', textDecoration: 'none', minHeight: 178,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="worth" size={17} strokeWidth={1.9} />
        <span style={{ flex: 1, fontSize: 'var(--step-2)', fontWeight: 600 }}>Six months</span>
        <Icon name="tag" size={0} />
      </span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 62 }}>
        {vals.map((v, i) => (
          <span key={trend[i]?.month ?? i} aria-hidden style={{
            flex: 1, height: `${Math.max(4, (v / peak) * 100)}%`, borderRadius: 4,
            background: i === vals.length - 1 ? 'var(--c-primary-hi)' : 'var(--c-track)',
          }} />
        ))}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="t n" style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{format(last)}</span>
        <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          {change === null
            ? 'this month so far'
            : change === 0 ? 'the same as last month'
            : `${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than last month`}
        </span>
      </span>
    </Link>
  );
}

/* What is out on loan, and what is owed the other way. Money lent is not
   spending, so it never shows in the month card — which is exactly why it
   needs a card of its own rather than being invisible until somebody goes
   looking for it. */
function LoanCard({ lent, owedToYou }: { lent: number; owedToYou: number }) {
  const { format } = useMoney();
  const youOwe = lent < 0 ? -lent : 0;
  const out = owedToYou + Math.max(0, lent);

  return (
    <Link href="/people" transitionTypes={['nav-forward']} className="el2 press" style={{
      display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 22, padding: '18px 17px',
      background: 'var(--c-card)', border: '1px solid var(--c-border)',
      color: 'var(--c-ink)', textDecoration: 'none', minHeight: 178,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="receivable" size={17} strokeWidth={1.9} />
        <span style={{ flex: 1, fontSize: 'var(--step-2)', fontWeight: 600 }}>Loans</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, justifyContent: 'center' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '.11em',
          textTransform: 'uppercase', color: 'var(--c-meta)',
        }}>Owed to you</span>
        <span className="t n" style={{ fontSize: 'var(--step-3)', fontWeight: 700, lineHeight: 1.05 }}>
          {format(out)}
        </span>
      </span>
      <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        {out === 0 && youOwe === 0
          ? 'Nothing outstanding with anybody.'
          : youOwe > 0
            ? `You owe ${format(youOwe)} the other way.`
            : 'Money lent is not spending — it sits here until it comes back.'}
      </span>
    </Link>
  );
}
