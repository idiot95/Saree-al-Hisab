import { redirect } from 'next/navigation';
import { actorOrNull, categoriesFor, tabsForEntry, openClaimsFor, scanningState, topCategories, lastPaidWith } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import { defaultRef, findRef } from '@/lib/pay';

export type AddSearch = { amount?: string; on?: string; merchant?: string;
                          kind?: string; category?: string; tab?: string; to?: string; from?: string };

/* Everything Add Entry needs, for both ways it opens: the full page at /add (a direct link, a scan, a reload) and
   the drawer over whatever screen the Add button was tapped on (app/@modal/(.)add). One loader, so the two can
   never offer different choices or check a draft differently. */
export async function loadAdd(q: AddSearch) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const household_id = actor.household_id;
  const [categories, ways, tabs, claims, scanning, topExpense, topIncome, lastPaid] = await withHousehold(household_id, () => Promise.all([
    categoriesFor(household_id),
    waysToPay(household_id),
    tabsForEntry(household_id),
    openClaimsFor(household_id),
    scanningState(household_id),
    topCategories(household_id, 'expense'),
    topCategories(household_id, 'income'),
    lastPaidWith(actor.user_id),
  ]));
  /* The way this person last paid with, if it still names one of these books' ways. It is a preference that can
     go stale (an archived rail, a reference from the other set of books they keep), so it is resolved exactly as
     resolvePayment does — findRef over this household's waysToPay, which are already loaded — and anything that
     names nothing falls back to the first way. A stale preference never reaches the form. */
  const paidWith = lastPaid && findRef(ways, lastPaid) ? lastPaid : defaultRef(ways);
  const today = new Date().toISOString().slice(0, 10);

  /* A draft handed over from a scan. Every value is re-checked here: it
     arrived in a URL, so it is no more trustworthy than anything else a client
     sends, whatever produced it. */
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

  return {
    draft, categories, ways, tabs, today, householdId: household_id,
    top: { expense: topExpense, income: topIncome },
    paidWith, lastPaid: paidWith === lastPaid ? lastPaid : null,
    // The camera in the header is offered only where a scan can work: a key set, and someone who may add.
    canScan: scanning.has_key && actor.role !== 'viewer',
    claims: claims.map((c) => ({
      id: c.id, person: c.person, tint: c.tint, tab: c.tab, what: c.what,
      on: new Date(c.occurred_on).toISOString().slice(0, 10), outstanding: Number(c.outstanding),
    })),
  };
}
