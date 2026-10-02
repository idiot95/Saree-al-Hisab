import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, budgetFor, entriesFor, inboxCount, monthTotals } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format, monthKey } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import EntryList from './EntryList';
import ActivityNav from './ActivityNav';
import { byDay } from './rows';
import { IconX } from '@tabler/icons-react';
import MonthPill from '../MonthPill';

export const metadata = { title: 'Entries · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const monthLabel = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });


export default async function Entries({ searchParams }: {
  searchParams: Promise<{ m?: string; c?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m, c } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(new Date());
  const categoryId = c && /^[0-9a-f-]{36}$/.test(c) ? c : null;
  const hh = actor.household_id;
  const [entries, categories, totals, inbox] = await withHousehold(hh, () => Promise.all([
    entriesFor(hh, month, categoryId),
    budgetFor(hh, month),
    monthTotals(hh, month),
    inboxCount(hh),
  ]));
  const filtered = categories.find((x) => x.category_id === categoryId)
    ?? categories.flatMap((x) => x.kids.map((k) => ({ ...k, name: `${x.name} › ${k.name}` })))
      .find((k) => k.id === categoryId);
  const days = byDay(entries);

  /* What the month cost comes from spend_txn, never from adding up the rows
     on screen. A cost laid out for someone shows here as the payment that
     happened, and none of it is spending — summing the list would count it. */
  const spent = filtered ? Number(filtered.spent) : Number(totals.spent);
  const keep = categoryId ? `&c=${categoryId}` : '';

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <header className="flex flex-col gap-3 px-[var(--gutter)] pb-4 pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-[30px] leading-tight">{filtered ? filtered.name : 'Activity'}</h1>
              <p className="text-sm text-muted-foreground">
                <span className="whitespace-nowrap">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                {' · '}<span className="whitespace-nowrap">{format(spent)} spent</span>
              </p>
            </div>
            <MonthPill month={month} path="/entries" keep={keep} />
          </div>
          {!filtered && <ActivityNav current="entries" review={inbox.duplicates + inbox.bills} />}
          {filtered && (
            <Link href={`/entries?m=${month}`} className="flex min-h-11 items-center gap-1.5 self-start rounded-full bg-accent px-3.5 text-sm font-semibold text-accent-foreground">
              <IconX size={14} aria-hidden /> Showing one category
            </Link>
          )}
        </header>
        {entries.length === 0 ? (
          <p className="px-8 py-10 text-center text-muted-foreground">
            Nothing recorded for {monthLabel(month)}{filtered ? ` under ${filtered.name}` : ''} yet.
          </p>
        ) : (
          <EntryList days={days} canEdit={actor.role !== 'viewer'} tools />
        )}
        <TabBar current="/entries" />
      </main>
    </Screen>
  );
}
