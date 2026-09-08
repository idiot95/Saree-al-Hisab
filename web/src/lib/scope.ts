/* What a category files, and whether an entry of a given kind may wear it.

   A category is for spending ('expense'), for income ('income'), or for
   either ('both'). Income wears an income or both category; everything else
   — spending, a refund of it, money laid out for someone — wears an expense
   or both category. Postgres holds the rule (0108); this is the same rule
   for the pickers, so a form only offers what would be accepted, and for
   the actions, so a refusal is a sentence rather than a constraint name.   */

export type Scope = 'expense' | 'income' | 'both';

export const SCOPES: readonly Scope[] = ['expense', 'income', 'both'];

export const isScope = (s: unknown): s is Scope => (SCOPES as readonly unknown[]).includes(s);

/** Whether a category of this scope takes an entry (or schedule) of this kind. */
export function fits(scope: Scope | null | undefined, kind: string): boolean {
  const s = scope ?? 'expense';
  if (s === 'both') return true;
  return kind === 'income' ? s === 'income' : s === 'expense';
}

/** Why it does not, in a sentence. */
export function misfit(kind: string, name: string): string {
  return kind === 'income'
    ? `${name} is for spending. Choose a category for income.`
    : `${name} is for income. Choose a category for spending.`;
}

/** What a scope is called on a form. */
export const SCOPE_LABEL: Record<Scope, string> = {
  expense: 'Spending', income: 'Income', both: 'Both',
};
