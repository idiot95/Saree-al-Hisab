/* How a cost laid out for other people is divided among them.

   A tab is a lending group, not a bill splitter: what goes on it is owed back,
   and the only question is how much each person owes. Equal shares, the first
   few carrying the odd paisa so the shares add up to exactly what was laid
   out. Never a fraction — a rupee that does not reconcile is how a khata
   stops being believed. */

/** Each person's share of `coveredMinor`, in paise, for `members` people. */
export function shares(coveredMinor: number, members: number): number[] {
  if (members <= 0 || coveredMinor <= 0) return [];
  const each = Math.floor(coveredMinor / members);
  const odd = coveredMinor - each * members;
  return Array.from({ length: members }, (_, i) => each + (i < odd ? 1 : 0));
}

/** What a cost of `amountMinor` breaks into when `coveredMinor` of it is being
 *  laid out for `members` people: their shares, and what is left as genuinely
 *  yours — the part that counts as spending and lands in the budget. */
export function breakdown(amountMinor: number, coveredMinor: number, members: number) {
  const covered = Math.max(0, Math.min(amountMinor, coveredMinor));
  return { shares: shares(covered, members), mine: amountMinor - covered };
}
