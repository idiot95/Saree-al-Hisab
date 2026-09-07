import { redirect } from 'next/navigation';
import AddEntry from './AddEntry';
import { actorOrNull, categoriesFor, methodsFor, accountsFor, tabsForEntry } from '@/db/queries';
import Screen from '../Screen';

export const metadata = { title: 'New entry · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: {
  searchParams: Promise<{ amount?: string; on?: string; merchant?: string;
                          kind?: string; category?: string; tab?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const household_id = actor.household_id;
  const [categories, methods, accounts, tabs] = await Promise.all([
    categoriesFor(household_id),
    methodsFor(household_id),
    accountsFor(household_id),
    tabsForEntry(household_id),
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
    kind: (q.kind === 'expense' || q.kind === 'income' ? q.kind : null) as
      'expense' | 'income' | null,
    categoryId: categories.some((c) => c.id === q.category) ? q.category! : null,
    // Arrived from a tab's own screen: only an open tab of this household's is honoured.
    tabId: tabs.some((t) => t.id === q.tab) ? q.tab! : null,
    tabCoveredMinor: null,
  };

  return (
    <Screen>
      <AddEntry
        draft={draft}
        categories={categories.map((c) => ({
          id: c.id, name: c.name, tint: c.tint, icon: c.icon,
        }))}
        methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
        accounts={accounts}
        tabs={tabs}
        today={today}
        householdId={household_id}
      />
    </Screen>
  );
}
