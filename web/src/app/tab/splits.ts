/* The two ways a cost on a tab can be shared. Plain data, kept out of the
   client form so the tab's own screen (a server component) can use the same
   words without importing a client module. */
export const SPLITS = [
  { id: 'equal', label: 'Split equally, us included',
    what: 'Divided among everyone on the tab and the household. Each owes one share; ours is not owed.' },
  { id: 'full', label: 'They owe all of it',
    what: 'We paid on their behalf. The whole cost is divided among the people on the tab.' },
] as const;

export type Split = (typeof SPLITS)[number]['id'];

/** Each member's share of an amount, in paise. Equal: the household is one of
 *  n+1 sharers and keeps the remainder — the one who paid absorbs the odd
 *  paisa. Full: divided among the n members, the first few carrying the odd
 *  paisa so the shares add up to exactly the cost. Never a fraction. */
export function shares(amountMinor: number, split: Split, members: number): number[] {
  if (members <= 0) return [];
  if (split === 'equal') {
    const each = Math.floor(amountMinor / (members + 1));
    return Array.from({ length: members }, () => each);
  }
  const each = Math.floor(amountMinor / members);
  const odd = amountMinor - each * members;
  return Array.from({ length: members }, (_, i) => each + (i < odd ? 1 : 0));
}
