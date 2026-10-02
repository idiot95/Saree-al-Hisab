/* Net worth, in one place, so the figure on Money and the one on the Net worth screen cannot disagree.

   Held: every account that is yours — bank, cash, savings — less the cards, which are money already spent.
   Owed to you: loans handed to people, and shares of costs you covered that are still outstanding (`claimed`,
   plus what tabs with nobody named are owed, `held`). Money you borrowed from someone is a debt like a card. */
export type BalanceRow = { kind: string; balance: string };

export function netWorth<T extends BalanceRow>(accounts: T[], claimed: number, held: number) {
  const own = accounts.filter((a) => a.kind !== 'person');
  const people = accounts.filter((a) => a.kind === 'person');
  const lent = people.filter((a) => Number(a.balance) > 0);
  const borrowed = people.filter((a) => Number(a.balance) < 0);
  const assets = own.filter((a) => Number(a.balance) > 0);
  const debts = [...own.filter((a) => Number(a.balance) < 0), ...borrowed];
  const assetTotal = assets.reduce((n, a) => n + Number(a.balance), 0);
  const debtTotal = debts.reduce((n, a) => n + Number(a.balance), 0);
  const claims = claimed + held;
  const receivable = lent.reduce((n, a) => n + Number(a.balance), 0) + claims;
  const savings = own.filter((a) => a.kind === 'savings').reduce((n, a) => n + Number(a.balance), 0);
  return { worth: assetTotal + receivable + debtTotal, assetTotal, debtTotal, receivable, claims, savings, assets, debts, lent, borrowed, own };
}

/* What people owe you, as Loans counts it — one definition for Loans and Home. Open claims only: a written-off
   claim keeps an outstanding figure, but nobody is expected to pay it. Money lent counts while a person's balance
   is positive; a negative balance is money you owe them, said apart. */
export function owedToYou(claims: { status: string; outstanding: string }[], people: { balance: string }[]) {
  const onClaims = claims
    .filter((c) => c.status === 'open' || c.status === 'part_paid')
    .reduce((n, c) => n + Number(c.outstanding), 0);
  const lentOut = people.reduce((n, p) => n + Math.max(0, Number(p.balance)), 0);
  const youOwe = people.reduce((n, p) => n - Math.min(0, Number(p.balance)), 0);
  return { owed: onClaims + lentOut, onClaims, lentOut, youOwe };
}
