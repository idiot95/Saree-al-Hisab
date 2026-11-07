'use client';

import { EmptyLine } from '../entries/parts';
import { useState } from 'react';
import Link from '@/app/NavLink';
import { Figure } from '../Figure';
import { Icon } from '../Icon';
import { useMoney } from '../currency';
import OwnerChips from './OwnerChips';
import HoldingRow from './HoldingRow';
import dynamic from 'next/dynamic';
import WhenNear from '../WhenNear';
import type { HoldingItem, RateNote, SeriesPoint, WealthView as View } from './types';

/* The part of Wealth that changes with the owner chip. Every set of figures arrived with the page; a chip only
   picks which one is drawn, so the headline and the legend roll to their new values (Figure) and nothing is
   fetched. The holdings listed follow the same choice: a member's own, the joint ones, or all of them. */
/* Recharts is a large library and the chart is below the fold on one view only: it loads when it is drawn. */
const WorthChart = dynamic(() => import('./WorthChart'), { ssr: false });

const CLASSES = [
  { key: 'bank', word: 'Bank & cash', swatch: 'bg-hero-1' },
  { key: 'pots', word: 'Pots', swatch: 'bg-hero-2' },
  { key: 'metals', word: 'Gold & silver', swatch: 'bg-hero-3' },
  { key: 'owed', word: 'Owed to you', swatch: 'bg-hero-4' },
] as const;

export default function WealthView({ views, initial, items, potRates, metalRates, series }: {
  views: View[]; initial: string; items: HoldingItem[]; potRates: RateNote; metalRates: RateNote; series: SeriesPoint[];
}) {
  const [key, setKey] = useState(initial);
  const v = views.find((x) => x.key === key) ?? views[0];
  const { format } = useMoney();

  const mine = items.filter((h) => v.key === 'household' || (v.key === 'joint' ? h.owner === null : h.owner === v.key));
  const pots = mine.filter((h) => h.kind === 'fx_cash');
  const metals = mine.filter((h) => h.kind === 'metal');
  // What is owed to you is the household's, never a member's, so a member's legend leaves it out.
  const parts = CLASSES.filter((c) => c.key !== 'owed' || v.counted).map((c) => ({ ...c, value: v[c.key] }));
  const whole = parts.reduce((n, p) => n + p.value, 0);
  const inBar = parts.filter((p) => p.value > 0);

  return (
    <div className="flex flex-col gap-4">
      <OwnerChips chips={views} current={v.key} onPick={setKey} />

      <section aria-label={v.title} className="mx-[var(--gutter)] flex flex-col gap-3 rounded-[22px] bg-hero p-[18px] text-hero-foreground">
        <span className="text-subhead text-hero-muted">{v.title}</span>
        <Figure minor={v.worth} className="text-display font-bold leading-none tracking-tight tabular-nums" />
        {/* The bar is the shape; the legend under it is the record, word and figure for each class. */}
        <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-hero-foreground/15">
          {whole > 0 && inBar.map((p) => (
            <span key={p.key} className={`${p.swatch} basis-0 transition-[flex-grow] duration-(--dur-flourish) ease-out`}
              style={{ flexGrow: p.value }} />
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-footnote">
          {parts.map((p) => (
            <div key={p.key} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 flex-none rounded-[3px] ${p.swatch}`} />
              <dt className="text-hero-muted">{p.word}</dt>
              <dd className="ml-auto font-semibold tabular-nums"><Figure minor={p.value} /></dd>
            </div>
          ))}
        </dl>
        {v.debt !== 0 && (
          <p className="flex items-center justify-between border-t border-hero-foreground/15 pt-2 text-footnote">
            <span className="text-hero-muted">{v.counted ? 'Less cards and money you owe' : 'Less cards and money owed'}</span>
            <span className="font-semibold tabular-nums"><Figure minor={v.debt} /></span>
          </p>
        )}
        {v.unvalued > 0 && (
          <p className="flex items-center gap-1.5 text-footnote text-hero-muted">
            <Icon name="info" size={15} />
            {v.unvalued === 1 ? 'One holding is' : `${v.unvalued} holdings are`} not valued yet and not counted.
          </p>
        )}
      </section>

      {pots.length > 0 && (
        <Section title="Pots in other currencies" rates={potRates}>
          <ul>{pots.map((h) => <HoldingRow key={h.id} h={h} value={h.value === null ? null : format(h.value)} />)}</ul>
        </Section>
      )}
      {metals.length > 0 && (
        <Section title="Gold & silver" rates={metalRates}>
          <ul>{metals.map((h) => <HoldingRow key={h.id} h={h} value={h.value === null ? null : format(h.value)} />)}</ul>
        </Section>
      )}

      <section aria-label="Accounts and what is owed to you" className="mx-[var(--gutter)] rounded-[18px] bg-card">
        <Row href="/accounts" icon="account_balance" word="Accounts & cards" value={format(v.accounts)} />
        {v.counted && <Row href="/people" icon="handshake" word="Owed to you" value={format(v.owed)} lateral />}
      </section>

      {pots.length === 0 && metals.length === 0 && (
        <EmptyLine icon="currency_exchange" className="mx-[var(--gutter)] rounded-[18px] bg-card">
          Keep a pot in another currency, or gold and silver, with + above. Each is priced in your currency every day.
        </EmptyLine>
      )}

      {v.key === 'household' && series.length > 1 && (
        <section aria-label="Month by month" className="mx-[var(--gutter)] flex flex-col gap-2">
          <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">Month by month</h2>
          <div className="rounded-[18px] bg-card p-4">
            <figure className="flex flex-col gap-2">
              <WhenNear className="h-36"><WorthChart series={series} /></WhenNear>
              <figcaption className="text-footnote leading-relaxed text-muted-foreground">
                {heldChange(series, format)} What people owe you is in the figure above but not in this line.
              </figcaption>
            </figure>
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, rates, children }: { title: string; rates: RateNote; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mx-[var(--gutter)] flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-subhead font-semibold text-muted-foreground">{title}</h2>
        {rates.asOf && <span className="text-footnote text-muted-foreground">Rates {rates.asOf}</span>}
      </div>
      {rates.stale.map((s) => (
        <p key={s} className="flex items-center gap-1.5 px-0.5 text-footnote text-attention-soft-foreground">
          <Icon name="sync_problem" size={15} />{s}
        </p>
      ))}
      <div className="overflow-hidden rounded-[18px] bg-card">{children}</div>
    </section>
  );
}

function Row({ href, icon, word, value, lateral }: { href: string; icon: string; word: string; value: string; lateral?: boolean }) {
  return (
    <Link href={href} motion={lateral ? 'fade' : 'push'}
      className="press flex min-h-14 items-center gap-3 border-b border-border px-3.5 last:border-b-0">
      <Icon name={icon} size={22} className="text-primary" />
      <span className="flex-1 text-body">{word}</span>
      <span className="text-body font-semibold tabular-nums">{value}</span>
      <Icon name="chevron_right" size={18} className="text-muted-foreground" />
    </Link>
  );
}

/* The line's caption, in words: drawn with the page, not with the lazy chart, so its height is there from the first
   paint and nothing moves when the chart arrives. */
function heldChange(series: SeriesPoint[], format: (minor: number) => string) {
  const total = (p: SeriesPoint) => p.held + p.holdings;
  const a = series[0], b = series[series.length - 1];
  const change = total(b) - total(a);
  return change === 0 ? `Level since ${a.month}.`
    : `${format(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than in ${a.month}, in accounts and holdings.`;
}
