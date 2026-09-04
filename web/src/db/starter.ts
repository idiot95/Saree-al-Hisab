import 'server-only';
import type { TransactionSql } from 'postgres';

/* What a brand-new household opens with.
   Deliberately thin. Nobody wants to arrive and find eight of somebody else's
   bank accounts already sitting there — but an empty app cannot record a
   single thing, because an entry needs a way to pay and a way to pay needs an
   account behind it. So: cash, which everybody has, and the categories most
   Indian households actually spend under. Everything else they add. */

const CATEGORIES: [string, string, string][] = [
  ['Rent', 'house2', 'green'],
  ['Groceries', 'cart', 'green'],
  ['School fees', 'child', 'orange'],
  ['Eating out', 'cutlery', 'orange'],
  ['Shopping', 'bag', 'purple'],
  ['Children', 'child', 'pink'],
  ['Utilities', 'bulb', 'cyan'],
  ['Transport', 'car', 'blue'],
];

export async function starterKitFor(tx: TransactionSql, householdId: string) {
  const [cash] = await tx`
    insert into account (household_id, name, kind, opening_balance)
    values (${householdId}, 'Cash', 'cash', 0) returning id`;

  await tx`
    insert into payment_method (household_id, name, kind, funding_account_id, is_default, sort_order)
    values (${householdId}, 'Cash', 'cash', ${cash.id}, true, 0)`;

  for (const [i, [name, icon, tint]] of CATEGORIES.entries()) {
    await tx`
      insert into category (household_id, name, icon, tint, sort_order)
      values (${householdId}, ${name}, ${icon}, ${tint}, ${i})`;
  }
}
