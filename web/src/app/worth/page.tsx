import { redirect } from 'next/navigation';
import { actorOrNull, monthlySeries, worthSeries } from '@/db/queries';
import { worthInput } from '@/db/worth';
import { withHousehold } from '@/db/client';
import { netWorth, type Owner } from '@/lib/worth';
import { format, unitOf } from '@/lib/money';
import { dayLabel, gramsLabel, purityLabel } from '@/lib/holding-input';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import WealthView from './WealthView';
import AddHolding from './AddHolding';
import type { HoldingItem, RateNote, SeriesPoint, WealthView as View } from './types';

export const metadata = { title: 'Wealth · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/* Wealth: whose net worth (the owner chips), the figure and what it is made of, then each kind of thing held.

   Every choice of owner is worked out here, on the server, from the one definition (netWorth), and handed down
   whole: switching a chip is then a client-side change of which set is drawn, so the figures roll from one to
   the next instead of the screen reloading. The chips are still links (?o=), so without script they work as
   plain navigation and the server draws the chosen set first. */
export default async function Worth({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const hh = actor.household_id;

  /* The inputs netWorth() reads — worthInput is the one path, shared with Home's row, so the two figures cannot
     disagree — and the line, in one transaction, at the last stored rates. Nothing is fetched or written here
     (v3.1 P5), so this render is safe to prefetch: `stale` names the rates over a day old, drawn as older rates,
     and the screen asks POST /api/rates to refresh them once it is on the phone (RefreshRates). */
  const [{ input, members, holdings, stale }, allSeries, months] = await withHousehold(hh, () => Promise.all([
    worthInput(hh, actor.currency, { due: true }), worthSeries(hh, 6), monthlySeries(hh, 6),
  ]));
  const memberIds = input.members;
  const fx = holdings.filter((h) => h.kind === 'fx_cash');
  const metal = holdings.filter((h) => h.kind === 'metal');

  /* Household · Me · each other member · Joint. A member is a current member: an owner who has left counts
     as joint, which is what netWorth does too. */
  const me = members.find((m) => m.id === actor.user_id);
  const others = members.filter((m) => m.id !== actor.user_id);
  const choices: { key: string; chip: string; title: string; owner: Owner }[] = [
    { key: 'household', chip: 'Household', title: 'Household net worth', owner: { kind: 'household' } },
    ...(me ? [{ key: me.id, chip: 'Me', title: 'Your net worth', owner: { kind: 'member', userId: me.id } as Owner }] : []),
    ...others.map((m) => ({ key: m.id, chip: first(m.name), title: `${first(m.name)}’s net worth`, owner: { kind: 'member', userId: m.id } as Owner })),
    { key: 'joint', chip: 'Joint', title: 'Joint net worth', owner: { kind: 'joint' } },
  ];
  const views: View[] = choices.map(({ key, chip, title, owner }) => {
    const w = netWorth(input, owner);
    const pots = netWorth({ ...input, holdings: fx }, owner).holdingTotal;
    const metals = netWorth({ ...input, holdings: metal }, owner).holdingTotal;
    const ownNet = w.own.reduce((n, a) => n + Number(a.balance), 0);
    return {
      key, chip, title, worth: w.worth, bank: w.accountAssetTotal, pots, metals, owed: w.receivable,
      debt: w.debtTotal, accounts: ownNet, counted: owner.kind !== 'member', unvalued: w.unvalued.length,
    };
  });
  const { o } = await searchParams;
  const initial = views.some((v) => v.key === o) ? o! : 'household';

  const nameOf = (id: string | null) => {
    const m = id ? members.find((x) => x.id === id) : undefined;
    return m ? first(m.name) : 'Joint';
  };
  const items: HoldingItem[] = holdings.map((h) => {
    const owner = h.owner_user_id && memberIds.includes(h.owner_user_id) ? h.owner_user_id : null;
    const q = Number(h.quantity ?? 0);
    const native = h.kind === 'fx_cash'
      ? format(q, h.currency!, { paise: q % unitOf(h.currency!) !== 0 })
      : `${gramsLabel(q)} g`;
    return {
      id: h.id, kind: h.kind, name: h.name, owner, ownerName: nameOf(owner), native,
      badge: h.kind === 'fx_cash' ? h.currency! : purityLabel(h.metal, h.purity_permille),
      value: h.value_minor === null ? null : Number(h.value_minor),
      stale: !!h.rate_as_of && h.rate_source !== 'override'
        && stale.includes(h.kind === 'fx_cash' ? h.currency! : h.metal === 'gold' ? 'XAU' : 'XAG'),
    };
  });

  /* "Rates 6 Nov" is the newest rate a section's values use. A rate over a day old is said with its date (the
     screen adds whether it is updating or could not); one the household set itself is theirs to keep, and is not
     called out of date. */
  const note = (rows: typeof holdings, label: (h: (typeof holdings)[number]) => string): RateNote => {
    const dates = rows.map((h) => h.rate_as_of).filter((d): d is string => !!d).sort();
    const lines = new Map<string, { base: string; label: string; from: string }>();
    for (const h of rows) {
      const base = h.kind === 'fx_cash' ? h.currency! : h.metal === 'gold' ? 'XAU' : 'XAG';
      if (!stale.includes(base) || !h.rate_as_of || h.rate_source === 'override') continue;
      lines.set(base, { base, label: label(h), from: dayLabel(h.rate_as_of) });
    }
    return { asOf: dates.length ? dayLabel(dates[dates.length - 1]) : null, stale: [...lines.values()] };
  };
  const potRates = note(fx, (h) => h.currency!);
  const metalRates = note(metal, (h) => (h.metal === 'gold' ? 'Gold' : 'Silver'));

  /* The line starts at the first month anything was recorded: before that the figure is only the opening
     balances, and a line measured against months the books were not kept says nothing. */
  const startAt = Math.max(0, months.findIndex((m) => m.entries > 0));
  const series: SeriesPoint[] = allSeries.slice(startAt).map((p) => ({
    month: new Date(p.month).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
    held: Number(p.held), holdings: Number(p.holdings),
  }));

  const canWrite = actor.role === 'owner' || actor.role === 'adult';

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <header className="flex items-end justify-between gap-3 px-[var(--gutter)] pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-subhead text-muted-foreground">{actor.household_name}</p>
            <h1 className="text-large-title font-bold leading-tight tracking-tight">Wealth</h1>
          </div>
          {canWrite && (
            <AddHolding base={actor.currency}
              members={members.map((m) => ({ id: m.id, name: m.id === actor.user_id ? `${first(m.name)} (you)` : first(m.name) }))} />
          )}
        </header>
        <WealthView views={views} initial={initial} items={items} potRates={potRates} metalRates={metalRates}
          series={series} due={stale} />
        <TabBar current="/worth" />
      </main>
    </Screen>
  );
}
