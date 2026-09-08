/* "the 5th", "the 21st", "the 3rd" — a day of the month as a person writes it.

   A statement day and a bill due day are shown on the accounts screen and
   again on every card face, so the rule lives in one place: the teens are all
   "th" (11th, 12th, 13th), and every other number takes the suffix of its
   last digit. */
const SUFFIX = ['th', 'st', 'nd', 'rd'] as const;

export function nth(d: number): string {
  const n = Math.trunc(d);
  const teen = Math.abs(n) % 100;
  const last = Math.abs(n) % 10;
  return `${n}${teen >= 11 && teen <= 13 ? 'th' : SUFFIX[last] ?? 'th'}`;
}
