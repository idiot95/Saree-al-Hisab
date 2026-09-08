import 'server-only';
import { sql, withHousehold } from './client';
import { findRef, type Way } from '@/lib/pay';

/* Every real account is a way to pay; a rail is a way of drawing on one.
   The pickers get the accounts with their rails nested, the actions hand a
   picked reference back and get the two ids the ledger writes.

   Order is the order a thumb wants: cash first, the everyday bank accounts,
   the cards, the savings that are rarely spent from — and within that, the
   account carrying the household's default rail goes first of all, since
   that is what most entries will use. */
export async function waysToPay(householdId: string): Promise<Way[]> {
  return withHousehold(householdId, async () => {
    const accounts = await sql`
      select id, name, kind from real_account
      where household_id = ${householdId} and archived_at is null
      order by case kind when 'cash' then 0 when 'spending' then 1 when 'credit' then 2 else 3 end, name
    ` as { id: string; name: string; kind: string }[];
    const rails = await sql`
      select id, name, kind, handle, is_default, funding_account_id
      from payment_method
      where household_id = ${householdId} and archived_at is null
      order by is_default desc, sort_order, name
    ` as { id: string; name: string; kind: string; handle: string | null;
           is_default: boolean; funding_account_id: string }[];
    const ways: Way[] = accounts.map((a) => ({
      id: a.id, name: a.name, kind: a.kind,
      rails: rails.filter((r) => r.funding_account_id === a.id)
        .map(({ id, name, kind, handle, is_default }) => ({ id, name, kind, handle, is_default })),
    }));
    const first = ways.findIndex((w) => w.rails.some((r) => r.is_default));
    if (first > 0) ways.unshift(...ways.splice(first, 1));
    return ways;
  });
}

/** The account and rail a picked reference stands for, checked against the
 *  household's own books — or null when it names none of them. Call it from
 *  inside the action's withHousehold: it shares the transaction. */
export async function resolvePayment(householdId: string, ref: string | null | undefined) {
  const hit = findRef(await waysToPay(householdId), ref);
  if (!hit) return null;
  return { account_id: hit.way.id, payment_method_id: hit.rail?.id ?? null };
}
