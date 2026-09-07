/* How the part of a cost that comes back is divided among the people it comes
   back from.

   A tab is not a bill splitter: what goes on it is owed back in full unless
   you say otherwise, and the only question is how much each person owes.
   Equal shares, the first few carrying the odd paisa so they add up to exactly
   what is claimed. Never a fraction — a rupee that does not reconcile is how a
   khata stops being believed. */

/** Each person's share of `coveredMinor`, in paise, for `members` people. */
export function shares(coveredMinor: number, members: number): number[] {
  if (members <= 0 || coveredMinor <= 0) return [];
  const each = Math.floor(coveredMinor / members);
  const odd = coveredMinor - each * members;
  return Array.from({ length: members }, (_, i) => each + (i < odd ? 1 : 0));
}
