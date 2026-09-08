import { redirect } from 'next/navigation';
import AddEntry from './AddEntry';
import { actorOrNull, categoriesFor, tabsForEntry, openClaimsFor } from '@/db/queries';
import { waysToPay } from '@/db/payment';
import Screen from '../Screen';

export const metadata = { title: 'New entry · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: {
  searchParams: Promise<{ amount?: string; on?: string; merchant?: string;
                          kind?: string; category?: string; tab?: string; to?: string; from?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const household_id = actor.household_id;
  const [categories, ways, tabs, claims] = await Promise.all([
    categoriesFor(household_id),
    waysToPay(household_id),
    tabsForEntry(household_id),
    openClaimsFor(household_id),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  /* A draft handed over from a scan. Every value is re-checked here: it
     arrived in a URL, so it is no more trustworthy than anything else a client
     sends, whatever produced it. */
  const q = await searchParams;
  const amount = Number(q.amount);
  const draft = {
    amountMinor: Number.isSafeInteger(amount) && amount > 0 && amount < 1e11 ? amount : null,
    occurredOn: q.on && /^\d{4}-\d{2}-\d{2}$/.test(q.on) ? q.on : null,
    merchant: typeof q.merchant === 'string' ? q.merchant.slice(0, 60) : null,
    kind: (q.kind === 'expense' || q.kind === 'income' || q.kind === 'transfer' ? q.kind : null) as
      'expense' | 'income' | 'transfer' | null,
    categoryId: categories.some((c) => c.id === q.category) ? q.category! : null,
    // Arrived from a tab's own screen: only an open tab of this household's is honoured.
    tabId: tabs.some((t) => t.id === q.tab) ? q.tab! : null,
    tabCoveredMinor: null,
    countsAsSpend: null,
    // A card bill from the inbox, or a swipe on an account: only this household's.
    toAccountId: ways.some((a) => a.id === q.to) ? q.to! : null,
    fromAccountId: ways.some((a) => a.id === q.from) ? q.from! : null,
  };

  return (
    <Screen>
      <AddEntry
        draft={draft}
        categories={categories}
        ways={ways}
        tabs={tabs}
        claims={claims.map((c) => ({
          id: c.id, person: c.person, tint: c.tint, tab: c.tab, what: c.what,
          on: new Date(c.occurred_on).toISOString().slice(0, 10), outstanding: Number(c.outstanding),
        }))}
        today={today}
        householdId={household_id}
      />
    </Screen>
  );
}
