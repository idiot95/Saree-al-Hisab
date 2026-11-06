import { allBalances, membersOf, owedByPerson, tabHeldOwed } from './queries';
import { holdingBases, holdingsFor } from './holdings';
import { ensureRates } from './prices';
import { withHousehold } from './client';

/* What netWorth() is worked out from, read the one way for every screen that shows it — Wealth and Home's
   net-worth row — so the two can never disagree: rates refreshed first (a pair older than a day is fetched,
   a failed provider leaves the last known rate and is named in `stale`), then the accounts, what is owed,
   the members and the valued holdings.

   Only Wealth refreshes rates (the default). Home passes { refreshRates: false }: it never waits on a rate
   provider, and values holdings at the last stored rates — the ones Wealth fetched. Called inside a caller's
   withHousehold, the reads share that transaction (a nested scope runs in the outer one). */
export async function worthInput(householdId: string, quote: string, { refreshRates = true } = {}) {
  let stale: string[] = [];
  if (refreshRates) {
    const bases = await holdingBases(householdId);
    ({ stale } = await ensureRates(householdId, bases, quote));
  }
  const [accounts, owed, held, members, holdings] = await withHousehold(householdId, () => Promise.all([
    allBalances(householdId),
    owedByPerson(householdId),
    tabHeldOwed(householdId),
    membersOf(householdId),
    holdingsFor(householdId),
  ]));
  const input = {
    accounts,
    claimed: owed.reduce((n, o) => n + Number(o.claimed), 0),
    held: Number(held),
    members: members.map((m) => m.id),
    holdings,
  };
  return { input, members, holdings, stale };
}
