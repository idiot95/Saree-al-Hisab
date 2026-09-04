/* The household from the designs, poured into books you already own.

   Signing up now gives everyone their own household with a thin starter kit —
   cash and the usual categories — so this script no longer creates anything to
   sign in to. It fills an existing set of books with the accounts, ways to pay
   and September budget the artboards were drawn against, so the screens have
   something to show.

   Run: npm run seed you@example.com                                          */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = /^DATABASE_URL="?([^"\n]+)/m.exec(readFileSync(join(root, '.env.local'), 'utf8'))[1];
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.error('\n  Which books? Pass the email you signed up with:\n');
  console.error('    npm run seed you@example.com\n');
  const who = await sql`select u.email, h.name from member m
    join app_user u on u.id = m.user_id join household h on h.id = m.household_id
    order by m.joined_at`;
  if (who.length) {
    console.error('  Accounts that exist right now:');
    for (const w of who) console.error(`    ${w.email}  →  ${w.name}`);
    console.error('');
  } else {
    console.error('  There are no accounts yet. Sign up first, at /signup.\n');
  }
  await sql.end(); process.exit(1);
}

const [target] = await sql`
  select m.household_id, h.name from member m
  join app_user u on u.id = m.user_id
  join household h on h.id = m.household_id
  where u.email = ${email} and m.role = 'owner'
  order by m.joined_at limit 1`;
if (!target) {
  console.error(`\n  No books owned by ${email}. Sign up first, or check the address.\n`);
  await sql.end(); process.exit(1);
}
const hh = target.household_id;

/* Idempotent: clears what this script put there before, and nothing else.
   Entries are left alone — seeding must never quietly delete a real month. */
const [{ n: entries }] = await sql`select count(*)::int as n from txn where household_id = ${hh}`;
if (entries > 0) {
  console.error(`\n  ${target.name} already has ${entries} entries. Refusing to reshuffle`);
  console.error('  the accounts underneath them. Seed a fresh set of books instead.\n');
  await sql.end(); process.exit(1);
}
await sql`delete from budget where household_id = ${hh}`;
await sql`delete from payment_method where household_id = ${hh}`;
await sql`delete from category where household_id = ${hh}`;
await sql`delete from account where household_id = ${hh}`;

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
  const [r] = await sql`insert into account ${sql({ household_id: hh, ...row })} returning id`;
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
    household_id: hh, name, icon, tint, sort_order: i })} returning id`;
  categories[key] = r.id;
}

for (const m of [
  { name: 'GPay', kind: 'upi', funding_account_id: accounts.hdfc, handle: 'abdeali@okhdfc', is_default: true, sort_order: 0 },
  { name: 'PhonePe', kind: 'upi', funding_account_id: accounts.icici, handle: 'abdeali@ybl', sort_order: 1 },
  { name: 'HDFC Regalia', kind: 'card', funding_account_id: accounts.card, handle: 'ends 8802', sort_order: 2 },
  { name: 'Cash', kind: 'cash', funding_account_id: accounts.cash, sort_order: 3 },
  { name: 'Net banking', kind: 'netbanking', funding_account_id: accounts.hdfc, handle: 'HDFC', sort_order: 4 },
]) {
  await sql`insert into payment_method ${sql({ household_id: hh, ...m })}`;
}

// September's budget. Monthly and carried forward — October is written as a
// copy of this when the month rolls over.
for (const [key, amount] of [
  ['rent', 4500000], ['groceries', 2500000], ['school', 2200000], ['children', 1500000],
  ['shopping', 1400000], ['eating', 1000000], ['utilities', 1000000], ['transport', 600000],
]) {
  await sql`insert into budget ${sql({
    household_id: hh, category_id: categories[key], month: '2026-09-01', amount })}`;
}

const [{ total: bud }] = await sql`select coalesce(sum(amount),0)::bigint as total from budget where household_id = ${hh}`;
console.log(`\n  ${target.name}`);
console.log(`  5 accounts · 8 categories · 5 ways to pay`);
console.log(`  September budget ₹${(Number(bud) / 100).toLocaleString('en-IN')}\n`);
await sql.end();
