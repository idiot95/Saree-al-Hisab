import { allBalances, claimsFor, membersOf, peopleFor } from './queries';
import { dueRateBases, holdingsFor } from './holdings';
import { withHousehold } from './client';
import { owedToYou } from '@/lib/worth';

/* What netWorth() is worked out from, read the one way for every screen that shows it — Wealth, Accounts and
   Home's net-worth row — so they can never disagree: the accounts, what is owed, the members and the valued
   holdings, at the last stored rates.

   What is owed comes from the same reads and the same function as Home's and Loans' "Owed to you"
   (claimsFor, peopleFor, owedToYou), so the label means one number everywhere: every open claim, a claim on an
   archived person included (money owed does not vanish when a person is archived), plus what people hold of
   money lent. The person accounts netWorth sees are the people peopleFor lists, so lent and borrowed are
   owedToYou's lentOut and youOwe exactly.

   Nothing here fetches a rate or writes (v3.1 P5): every screen values holdings at the last stored rates, so a
   render — a prefetch included — reads and nothing more. Wealth passes { due: true } and gets back, from the same
   transaction, the bases whose rate is over a day old (`stale`); it shows them as older rates and its screen asks
   POST /api/rates (src/app/api/rates/route.ts) to refresh them once it is on screen. Called inside a caller's
   withHousehold, the reads share that transaction (a nested scope runs in the outer one). */
export async function worthInput(householdId: string, quote: string, { due = false } = {}) {
  const [balances, claims, people, members, holdings, stale] = await withHousehold(householdId, () => Promise.all([
    allBalances(householdId),
    claimsFor(householdId),
    peopleFor(householdId),
    membersOf(householdId),
    holdingsFor(householdId),
    due ? dueRateBases(householdId, quote) : Promise.resolve([] as string[]),
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
