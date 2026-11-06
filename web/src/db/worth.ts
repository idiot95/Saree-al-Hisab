import { allBalances, claimsFor, membersOf, peopleFor } from './queries';
import { holdingBases, holdingsFor } from './holdings';
import { ensureRates } from './prices';
import { withHousehold } from './client';
import { owedToYou } from '@/lib/worth';

/* What netWorth() is worked out from, read the one way for every screen that shows it — Wealth, Accounts and
   Home's net-worth row — so they can never disagree: rates refreshed first (a pair older than a day is fetched,
   a failed provider leaves the last known rate and is named in `stale`), then the accounts, what is owed,
   the members and the valued holdings.

   What is owed comes from the same reads and the same function as Home's and Loans' "Owed to you"
   (claimsFor, peopleFor, owedToYou), so the label means one number everywhere: every open claim, a claim on an
   archived person included (money owed does not vanish when a person is archived), plus what people hold of
   money lent. The person accounts netWorth sees are the people peopleFor lists, so lent and borrowed are
   owedToYou's lentOut and youOwe exactly.

   Only Wealth refreshes rates (the default). Home and Accounts pass { refreshRates: false }: they never wait on
   a rate provider, and value holdings at the last stored rates — the ones Wealth fetched. Called inside a
   caller's withHousehold, the reads share that transaction (a nested scope runs in the outer one). */
export async function worthInput(householdId: string, quote: string, { refreshRates = true } = {}) {
  let stale: string[] = [];
  if (refreshRates) {
    const bases = await holdingBases(householdId);
    ({ stale } = await ensureRates(householdId, bases, quote));
  }
  const [balances, claims, people, members, holdings] = await withHousehold(householdId, () => Promise.all([
    allBalances(householdId),
    claimsFor(householdId),
    peopleFor(householdId),
    membersOf(householdId),
    holdingsFor(householdId),
  ]));
  const accounts = [
    ...balances.filter((a) => a.kind !== 'person'),
    ...people.map((p) => ({ id: p.account_id, name: p.name, kind: 'person', last4: null, balance: p.balance, owner_user_id: null })),
  ];
  const input = {
    accounts,
    claimed: owedToYou(claims, []).onClaims,
    held: 0,
    members: members.map((m) => m.id),
    holdings,
  };
  return { input, members, holdings, stale };
}
