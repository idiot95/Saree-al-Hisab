/* Net worth, in one place, so the figure on Money and the one on the Net worth screen cannot disagree.

   Held: every account that is yours — bank, cash, savings — less the cards, which are money already spent.
   Owed to you: loans handed to people, and shares of costs you covered that are still outstanding (`claimed`,
   plus what tabs with nobody named are owed, `held`). Money you borrowed from someone is a debt like a card. */
export type BalanceRow = { kind: string; balance: string };

/* A foreign-currency pot or a metal, priced in rupees by the `holding_value` view. `value_minor` arrives as a
   string, as postgres.js returns bigints, and is null when no rate is known. */
export type HoldingValue = {
  id: string; kind: 'fx_cash' | 'metal'; name: string;
  owner_user_id: string | null; value_minor: string | null; rate_as_of: string | null;
};
export type Owner = { kind: 'household' } | { kind: 'joint' } | { kind: 'member'; userId: string };

/* Whose is it? An owner who is no longer a member (or none at all) is joint: the money did not vanish when the
   person left. With no `members` list given, owners are taken as they stand. */
function ownerOf(id: string | null | undefined, members: string[] | undefined): string | null {
  if (!id) return null;
  return members && !members.includes(id) ? null : id;
}

/* Household: everything, exactly as before holdings existed. Joint: what has no (current) owner, plus what is
   owed to you. Member: only what that person owns; receivables are the household's, so they are 0 here, and
   person accounts never have an owner, so lent and borrowed money drop out too. Archived holdings are the
   caller's to leave out. A holding with no rate is listed in `unvalued` and kept out of every total. */
export function netWorth<T extends BalanceRow & { owner_user_id?: string | null }>(
  input: { accounts: T[]; claimed: number; held: number; holdings?: HoldingValue[]; members?: string[] },
  owner: Owner = { kind: 'household' },
) {
  const { claimed, held, members } = input;
  const keep = (id: string | null | undefined) => {
    if (owner.kind === 'household') return true;
    const o = ownerOf(id, members);
    return owner.kind === 'joint' ? o === null : o === owner.userId;
  };
  const accounts = input.accounts.filter((a) => keep(a.kind === 'person' ? null : a.owner_user_id));
  const mine = (input.holdings ?? []).filter((h) => keep(h.owner_user_id));
  const unvalued = mine.filter((h) => h.value_minor === null);
  const holdingTotal = mine.reduce((n, h) => (h.value_minor === null ? n : n + Number(h.value_minor)), 0);

  const own = accounts.filter((a) => a.kind !== 'person');
  const people = accounts.filter((a) => a.kind === 'person');
  const lent = people.filter((a) => Number(a.balance) > 0);
  const borrowed = people.filter((a) => Number(a.balance) < 0);
  const assets = own.filter((a) => Number(a.balance) > 0);
  const debts = [...own.filter((a) => Number(a.balance) < 0), ...borrowed];
  const assetTotal = assets.reduce((n, a) => n + Number(a.balance), 0) + holdingTotal;
  const debtTotal = debts.reduce((n, a) => n + Number(a.balance), 0);
  const counted = owner.kind !== 'member';
  const claims = counted ? claimed + held : 0;
  const receivable = counted ? lent.reduce((n, a) => n + Number(a.balance), 0) + claims : 0;
  const savings = own.filter((a) => a.kind === 'savings').reduce((n, a) => n + Number(a.balance), 0);
  return {
    worth: assetTotal + receivable + debtTotal, assetTotal, debtTotal, receivable, claims, savings, holdingTotal,
    unvalued, assets, debts, lent, borrowed, own,
  };
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
