import 'server-only';
import type { TransactionSql } from 'postgres';

/* What a brand-new household opens with.
   Deliberately thin. Nobody wants to arrive and find eight of somebody else's
   bank accounts already sitting there — but an empty app cannot record a
   single thing, because an entry needs a way to pay and a way to pay needs an
   account behind it. So: cash, which everybody has, and the categories most
   Indian households actually spend under. Everything else they add. */

const CATEGORIES: [string, string, string, 'expense' | 'income'][] = [
  ['Rent', 'house2', 'green', 'expense'],
  ['Groceries', 'cart', 'green', 'expense'],
  ['School fees', 'child', 'orange', 'expense'],
  ['Eating out', 'cutlery', 'orange', 'expense'],
  ['Shopping', 'bag', 'purple', 'expense'],
  ['Children', 'child', 'pink', 'expense'],
  ['Utilities', 'bulb', 'cyan', 'expense'],
  ['Transport', 'car', 'blue', 'expense'],
  /* And where money comes in from — a salary cannot be filed under
     Groceries, so without these an income entry has nowhere to go. The same
     six are given to a household from before scope existed (0108). */
  ['Salary', 'salary', 'green', 'income'],
  ['Business', 'briefcase', 'blue', 'income'],
  ['Rent received', 'building', 'cyan', 'income'],
  ['Interest & dividends', 'percent', 'indigo', 'income'],
  ['Gifts received', 'gift', 'pink', 'income'],
  ['Other income', 'coin', 'orange', 'income'],
];

export async function starterKitFor(tx: TransactionSql, householdId: string, currency: string) {
  const [cash] = await tx`
    insert into account (household_id, name, kind, currency, opening_balance)
    values (${householdId}, 'Cash', 'cash', ${currency}, 0) returning id`;

  await tx`
    insert into payment_method (household_id, name, kind, funding_account_id, is_default, sort_order)
    values (${householdId}, 'Cash', 'cash', ${cash.id}, true, 0)`;

  for (const [i, [name, icon, tint, scope]] of CATEGORIES.entries()) {
    await tx`
      insert into category (household_id, name, icon, tint, scope, sort_order)
      values (${householdId}, ${name}, ${icon}, ${tint}, ${scope}, ${i})`;
  }
}
