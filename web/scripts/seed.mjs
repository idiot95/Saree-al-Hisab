/* The household from the designs, in INR only.
   Multi-currency is phase 4, so the Cash (USD) account that was the designs'
   only savings-kind account is replaced by an INR recurring deposit — without
   it the Savings screen opens empty and the "savings sits outside the budget"
   rule has nothing to demonstrate.

   Run: npm run seed        (idempotent — clears and rebuilds the household)   */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = /^DATABASE_URL="?([^"\n]+)/m.exec(readFileSync(join(root, '.env.local'), 'utf8'))[1];
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

const HOUSEHOLD = 'Mogul Household';
const PHONE = '+919820441000';

await sql`delete from household where name = ${HOUSEHOLD}`;
await sql`delete from app_user where phone = ${PHONE}`;

const [hh] = await sql`insert into household ${sql({ name: HOUSEHOLD })} returning id`;
const [me] = await sql`insert into app_user ${sql({ phone: PHONE, name: 'Abdeali M' })} returning id`;
await sql`insert into member ${sql({ household_id: hh.id, user_id: me.id, role: 'owner' })}`;

const accounts = {};
for (const a of [
  { key: 'hdfc', name: 'HDFC Savings', kind: 'spending', opening_balance: 28353000, last4: '4471' },
  { key: 'icici', name: 'ICICI Savings', kind: 'spending', opening_balance: 7820000, last4: '9930' },
  { key: 'cash', name: 'Cash', kind: 'cash', opening_balance: 1845000 },
  { key: 'rd', name: 'HDFC Recurring Deposit', kind: 'savings', opening_balance: 4175000 },
  { key: 'card', name: 'HDFC Regalia', kind: 'credit', last4: '8802',
    credit_limit: 20000000, statement_day: 5, due_day: 12 },
]) {
  const { key, ...row } = a;
  const [r] = await sql`insert into account ${sql({ household_id: hh.id, ...row })} returning id`;
  accounts[key] = r.id;
}

const categories = {};
for (const [i, c] of [
  ['rent', 'Rent', 'house2', 'green'],
  ['groceries', 'Groceries', 'cart', 'green'],
  ['school', 'School fees', 'child', 'orange'],
  ['eating', 'Eating Out', 'cutlery', 'orange'],
  ['shopping', 'Shopping', 'bag', 'purple'],
  ['children', 'Children', 'child', 'pink'],
  ['utilities', 'Utilities', 'bulb', 'cyan'],
  ['transport', 'Transport', 'car', 'blue'],
].entries()) {
  const [key, name, icon, tint] = c;
  const [r] = await sql`insert into category ${sql({
    household_id: hh.id, name, icon, tint, sort_order: i })} returning id`;
  categories[key] = r.id;
}

for (const m of [
  { name: 'GPay', kind: 'upi', funding_account_id: accounts.hdfc, handle: 'abdeali@okhdfc', is_default: true, sort_order: 0 },
  { name: 'PhonePe', kind: 'upi', funding_account_id: accounts.icici, handle: 'abdeali@ybl', sort_order: 1 },
  { name: 'HDFC Regalia', kind: 'card', funding_account_id: accounts.card, handle: 'ends 8802', sort_order: 2 },
  { name: 'Cash', kind: 'cash', funding_account_id: accounts.cash, sort_order: 3 },
  { name: 'Net banking', kind: 'netbanking', funding_account_id: accounts.hdfc, handle: 'HDFC', sort_order: 4 },
]) {
  await sql`insert into payment_method ${sql({ household_id: hh.id, ...m })}`;
}

// September's budget. Monthly and carried forward — October is written as a
// copy of this when the month rolls over.
const month = '2026-09-01';
for (const [key, amount] of [
  ['rent', 4500000], ['groceries', 2500000], ['school', 2200000], ['children', 1500000],
  ['shopping', 1400000], ['eating', 1000000], ['utilities', 1000000], ['transport', 600000],
]) {
  await sql`insert into budget ${sql({
    household_id: hh.id, category_id: categories[key], month, amount })}`;
}

const [{ count: acc }] = await sql`select count(*)::int from account where household_id = ${hh.id}`;
const [{ count: cat }] = await sql`select count(*)::int from category where household_id = ${hh.id}`;
const [{ count: met }] = await sql`select count(*)::int from payment_method where household_id = ${hh.id}`;
const [{ total: bud }] = await sql`select coalesce(sum(amount),0)::bigint as total from budget where household_id = ${hh.id}`;

console.log(`\n  ${HOUSEHOLD}`);
console.log(`  ${acc} accounts · ${cat} categories · ${met} ways to pay`);
console.log(`  September budget ₹${(Number(bud) / 100).toLocaleString('en-IN')}`);
console.log(`  household ${hh.id}\n`);
await sql.end();
