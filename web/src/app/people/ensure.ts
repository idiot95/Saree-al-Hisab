import type { TransactionSql } from 'postgres';

/* Someone named on a form who may or may not already be in the khata. A tab
   opened with "Fatema" typed into it should not fail because Fatema was added
   last month, and should not make a second Fatema either — so the name is
   matched case-insensitively against the household's people first, and only
   a stranger gets a new person account. Runs inside the caller's transaction
   so the people and whatever they are being added to land together. */

const TINTS = ['green', 'orange', 'blue', 'purple', 'pink', 'cyan', 'rust', 'indigo'];

export type Named = { name: string; phone: string | null };

/** Names as they came off the form, cleaned: trimmed, 2–60 characters,
 *  duplicates within the list folded. Returns null if any is unusable, so the
 *  caller can refuse the whole form rather than silently drop one. */
export function readNames(names: string[], phones: string[]): Named[] | null {
  const seen = new Set<string>();
  const out: Named[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i].trim().replace(/\s+/g, ' ');
    if (name.length === 0) continue;
    if (name.length < 2 || name.length > 60) return null;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const phone = (phones[i] ?? '').trim().slice(0, 30) || null;
    out.push({ name, phone });
  }
  return out;
}

export async function ensurePeople(
  tx: TransactionSql, householdId: string, people: Named[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const p of people) {
    const [have] = await tx`
      select id from counterparty
      where household_id = ${householdId} and lower(name) = ${p.name.toLowerCase()}
        and archived_at is null`;
    if (have) { ids.push(have.id); continue; }
    const [{ n }] = await tx`
      select count(*)::int as n from counterparty where household_id = ${householdId}`;
    const [a] = await tx`
      insert into account (household_id, name, kind, opening_balance)
      values (${householdId}, ${p.name}, 'person', 0) returning id`;
    const [c] = await tx`
      insert into counterparty (household_id, name, phone, relationship, tint, account_id)
      values (${householdId}, ${p.name}, ${p.phone}, 'friend', ${TINTS[n % TINTS.length]}, ${a.id})
      returning id`;
    ids.push(c.id);
  }
  return ids;
}
