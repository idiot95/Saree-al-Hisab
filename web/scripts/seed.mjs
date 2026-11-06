/* The household from the designs, poured into books you already own.

   Signing up now gives everyone their own household with a thin starter kit —
   cash and the usual categories — so this script no longer creates anything to
   sign in to. It fills an existing set of books with the accounts, ways to pay
   and September budget the artboards were drawn against, so the screens have
   something to show.

   Run: npm run seed you@example.com
     npm run seed you@example.com -- --activity   (adds a realistic month or
       two of entries, a tab, schedules and card purchases; every row it makes
       has an id starting 5eed, so a re-run deletes and recreates only those)
     npm run seed you@example.com -- --wealth     (a second member, Sara; a USD
       pot, an AED pot, 50 g of 22k gold and a KWD pot; your own rates for
       USD, AED and gold dated yesterday, so a real fetch today replaces them
       and a failed one still values them; none for KWD, which stays "not
       valued yet" until a rate is fetched or set; and owners on the two banks.
       Ids start 5eed, so a re-run replaces only these) */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { LOCAL_HOSTS } from './local-only.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* The same database the app runs against, as its OWNER: the app connects as
   `saree_app` (APP_DATABASE_URL), which cannot bypass row security, and a
   script that saw only one household would be no use to anyone. */
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = process.env.DATABASE_URL
  ?? /^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1]
  ?? /^APP_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1]
  ?? /^DATABASE_URL="?([^"\n]+)/m.exec(envFile)[1];
/* Seeding writes sample books: it is for a local copy only, never the production store .env.local may name. */
{
  let host = null;
  try { host = new URL(url).hostname; } catch { /* unreadable URL: refused below */ }
  if (!LOCAL_HOSTS.includes(host)) {
    console.error(`refusing to seed: the database is on ${host ?? 'an unreadable URL'}. Point .env.local or DATABASE_URL at a local copy (localhost or 127.0.0.1).`);
    process.exit(2);
  }
}
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

const argv = process.argv.slice(2);
const withActivity = argv.includes('--activity');
const withWealth = argv.includes('--wealth');
const email = (argv.find((a) => !a.startsWith('--')) ?? '').trim().toLowerCase();
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

const SEED = '5eed';
const sid = (n) => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/* With --activity on books that already have the base kit, skip straight to
   the activity: the accounts, categories and ways to pay are looked up by name. */
const haveBase = (withActivity || withWealth) && (await sql`select 1 from account where household_id = ${hh} and name = 'HDFC Savings'`).length > 0;
const accounts = {};
const categories = {};
const methods = {};
let bud = 0;
if (!haveBase) {
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

for (const a of [
  { key: 'hdfc', name: 'HDFC Savings', kind: 'spending', opening_balance: 28353000, last4: '4471' },
  { key: 'icici', name: 'ICICI Savings', kind: 'spending', opening_balance: 7820000, last4: '9930' },
  { key: 'cash', name: 'Cash', kind: 'cash', opening_balance: 1845000 },
  { key: 'rd', name: 'HDFC Recurring Deposit', kind: 'savings', opening_balance: 4175000 },
  { key: 'card', name: 'HDFC Regalia', kind: 'credit', last4: '8802', bank_key: 'hdfc', card_network: 'visa',
    credit_limit: 20000000, statement_day: 5, due_day: 12 },
]) {
  const { key, ...row } = a;
  const [r] = await sql`insert into account ${sql({ household_id: hh, ...row })} returning id`;
  accounts[key] = r.id;
}

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
  const [pm] = await sql`insert into payment_method ${sql({ household_id: hh, ...m })} returning id`;
  methods[m.name] = pm.id;
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

bud = Number((await sql`select coalesce(sum(amount),0)::bigint as total from budget where household_id = ${hh}`)[0].total);
}


if (haveBase) {
  /* Looked up by name; a missing one is a stop, not an undefined that turns
     into a confusing insert error (or a row on the wrong account) later. */
  const want = {
    account: { 'HDFC Savings': 'hdfc', 'ICICI Savings': 'icici', Cash: 'cash', 'HDFC Recurring Deposit': 'rd', 'HDFC Regalia': 'card' },
    category: { Rent: 'rent', Groceries: 'groceries', 'School fees': 'school', 'Eating Out': 'eating', Shopping: 'shopping', Children: 'children', Utilities: 'utilities', Transport: 'transport' },
  };
  for (const r of await sql`select id, name from account where household_id = ${hh}`) if (want.account[r.name]) accounts[want.account[r.name]] = r.id;
  for (const r of await sql`select id, name from category where household_id = ${hh}`) if (want.category[r.name]) categories[want.category[r.name]] = r.id;
  for (const r of await sql`select id, name from payment_method where household_id = ${hh}`) methods[r.name] = r.id;
  const missing = [
    ...Object.entries(want.account).filter(([, k]) => !accounts[k]).map(([n]) => `account "${n}"`),
    ...Object.entries(want.category).filter(([, k]) => !categories[k]).map(([n]) => `category "${n}"`),
    ...['GPay', 'PhonePe', 'HDFC Regalia', 'Cash', 'Net banking'].filter((n) => !methods[n]).map((n) => `way to pay "${n}"`),
  ];
  if (missing.length) {
    console.error(`\n  --activity needs the base kit, but ${target.name} is missing: ${missing.join(', ')}.`);
    console.error('  Seed fresh books (no entries) first, or restore those names.\n');
    await sql.end(); process.exit(1);
  }
}

let activity = null;
if (withActivity) activity = await seedActivity();
let wealth = null;
if (withWealth) wealth = await seedWealth();

async function seedWealth() {
  const [{ id: me }] = await sql`
    select u.id from app_user u join member m on m.user_id = u.id
    where u.email = ${email} and m.household_id = ${hh}`;
  /* A second member, so the owner chips have someone to switch to. No password and no Google: nobody signs
     in as her, she only owns things. */
  const sara = sid(500);
  await sql`insert into app_user ${sql({ id: sara, name: 'Sara Mogul', email: 'sara.seed@example.com' })}
            on conflict (id) do nothing`;
  await sql`insert into member ${sql({ household_id: hh, user_id: sara, role: 'adult' })}
            on conflict do nothing`;

  await sql`delete from holding where household_id = ${hh} and id::text like ${SEED + '%'}`;
  const [{ today }] = await sql`select current_date::text as today`;
  const daysAgo = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() - n * 864e5).toISOString().slice(0, 10);

  const holdings = [
    // [n, name, owner, kind, currency, metal, purity, [[days ago, quantity], …]]
    [600, 'US savings', me, 'fx_cash', 'USD', null, null, [[40, 380000], [0, 420000]]],
    [601, 'Dubai account', null, 'fx_cash', 'AED', null, null, [[0, 1250000]]],
    [602, 'Jewellery', sara, 'metal', null, 'gold', 916, [[60, 42000], [0, 50000]]],
    [603, 'Kuwait cash', null, 'fx_cash', 'KWD', null, null, [[0, 1250500]]],
  ];
  for (const [n, name, owner, kind, currency, metal, purity, snaps] of holdings) {
    await sql`insert into holding ${sql({ id: sid(n), household_id: hh, owner_user_id: owner, kind, name, currency, metal, purity_permille: purity })}`;
    for (const [i, [d, quantity]] of snaps.entries()) {
      await sql`insert into holding_snapshot ${sql({ id: sid(n * 10 + i), holding_id: sid(n), household_id: hh,
        as_of: daysAgo(d), quantity, created_by: me })}`;
    }
  }
  /* Rates of the household's own, dated yesterday: a fetch that works today is newer and wins; one that fails
     leaves these. Gold is per gram of PURE metal. No KWD on purpose. */
  for (const [base, rate] of [['USD', '84.10'], ['AED', '22.90'], ['XAU', '11250']]) {
    await sql`insert into price_override ${sql({ household_id: hh, base, quote: 'INR', as_of: daysAgo(1), rate, set_by: me })}
              on conflict (household_id, base, quote, as_of) do update set rate = excluded.rate`;
  }
  // Whose the banks are, so Me and Sara have accounts of their own.
  if (accounts.hdfc) await sql`update account set owner_user_id = ${me} where id = ${accounts.hdfc}`;
  if (accounts.icici) await sql`update account set owner_user_id = ${sara} where id = ${accounts.icici}`;
  return { holdings: holdings.length };
}

async function seedActivity() {
  const [{ id: me }] = await sql`
    select u.id from app_user u join member m on m.user_id = u.id
    where u.email = ${email} and m.household_id = ${hh}`;
  const [{ today }] = await sql`select current_date::text as today`;
  const base = new Date(today + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => iso(new Date(base.getTime() - n * 864e5));
  const inDays = (n) => new Date(base.getTime() + n * 864e5);

  // Clear only what an earlier --activity run made (ids 5eed…). Entries go
  // first (claims and receipts follow them), then the people and their accounts.
  await sql`delete from txn where household_id = ${hh} and id::text like ${SEED + '%'}`;
  await sql`delete from schedule where household_id = ${hh} and id::text like ${SEED + '%'}`;
  await sql`delete from ledger_book where household_id = ${hh} and id::text like ${SEED + '%'}`;
  await sql`delete from counterparty where household_id = ${hh} and id::text like ${SEED + '%'}`;
  await sql`delete from account where household_id = ${hh} and id::text like ${SEED + '%'}`;

  let n = 1000;
  const txn = async (o) => {
    const row = { household_id: hh, created_by: me, source: 'manual', id: sid(++n), ...o };
    await sql`insert into txn ${sql(row)}`;
    return row.id;
  };
  const M = methods;
  // An entry's account is the one its way to pay draws on (the card, for a card purchase).
  const fundedBy = { GPay: accounts.hdfc, PhonePe: accounts.icici, 'HDFC Regalia': accounts.card, Cash: accounts.cash, 'Net banking': accounts.hdfc };
  const C = categories;
  const expenses = [
    // [days ago, amount rupees, category, method, merchant]
    [0, 640, 'eating', 'GPay', 'Bohri Kitchen'], [1, 2210, 'groceries', 'PhonePe', 'DMart'],
    [2, 480, 'transport', 'GPay', 'Uber'], [3, 1850, 'shopping', 'HDFC Regalia', 'Westside'],
    [4, 3200, 'utilities', 'Net banking', 'Tata Power'], [5, 760, 'eating', 'Cash', 'Cafe Madras'],
    [6, 1390, 'groceries', 'GPay', 'Reliance Fresh'], [7, 5200, 'children', 'HDFC Regalia', 'FirstCry'],
    [8, 310, 'transport', 'Cash', 'Auto'], [9, 2790, 'shopping', 'HDFC Regalia', 'Amazon'],
    [10, 920, 'eating', 'PhonePe', 'Theobroma'], [11, 1675, 'groceries', 'PhonePe', 'Nature\'s Basket'],
    [12, 45000, 'rent', 'Net banking', 'Rent, Bandra flat'], [13, 1100, 'utilities', 'GPay', 'Jio Fiber'],
    [14, 22000, 'school', 'Net banking', 'St. Xavier\'s term fees'], [15, 590, 'eating', 'Cash', 'Chai Point'],
    [16, 1480, 'shopping', 'HDFC Regalia', 'Zara'], [17, 850, 'transport', 'GPay', 'Metro card top-up'],
    [18, 2430, 'groceries', 'GPay', 'Big Basket'],
    [19, 4120, 'eating', 'HDFC Regalia', 'The Bombay Canteen, anniversary dinner with the whole family and cousins'],
    [20, 1240, 'children', 'PhonePe', 'Toy Library'],
    [24, 2550, 'groceries', 'GPay', 'DMart'], [26, 700, 'eating', 'Cash', 'Irani cafe'],
    [28, 3600, 'shopping', 'HDFC Regalia', 'Amazon'], [30, 940, 'transport', 'GPay', 'Uber'],
    [33, 2870, 'groceries', 'PhonePe', 'Reliance Fresh'], [34, 1999, 'utilities', 'Net banking', 'Airtel postpaid'],
    [36, 6800, 'children', 'HDFC Regalia', 'Decathlon, cricket kit and shoes and pads for the school team'],
    [38, 880, 'eating', 'GPay', 'Burger Singh'], [40, 45000, 'rent', 'Net banking', 'Rent, Bandra flat'],
    [41, 22000, 'school', 'Net banking', 'St. Xavier\'s term fees'], [43, 1520, 'groceries', 'GPay', 'DMart'],
    [45, 3150, 'utilities', 'Net banking', 'Tata Power'],
    [47, 2200, 'shopping', 'HDFC Regalia', 'Shoppers Stop, festive clothes for the children and parents'],
    [49, 640, 'transport', 'Cash', 'Auto'],
  ];
  for (const [d, rupees, cat, method, merchant] of expenses) {
    await txn({ kind: 'expense', amount: rupees * 100, currency: 'INR', occurred_on: daysAgo(d),
      account_id: fundedBy[method], category_id: C[cat], payment_method_id: M[method], merchant,
      is_shared: cat === 'groceries' || cat === 'rent' });
  }
  // Income: salary each month, and something on the side.
  for (const [d, rupees, acc, merchant] of [
    [5, 185000, 'hdfc', 'Salary, Acme Corp'], [35, 185000, 'hdfc', 'Salary, Acme Corp'], [14, 32000, 'icici', 'Freelance design work for the Dubai client'],
  ]) {
    await txn({ kind: 'income', amount: rupees * 100, currency: 'INR', occurred_on: daysAgo(d),
      account_id: accounts[acc], merchant });
  }

  // A pair that trips the duplicate detector: same account, same amount, two days apart.
  await txn({ kind: 'expense', amount: 123456, currency: 'INR', occurred_on: daysAgo(2), account_id: accounts.hdfc,
    category_id: C.shopping, payment_method_id: M.GPay, merchant: 'Croma Electronics' });
  await txn({ kind: 'expense', amount: 123456, currency: 'INR', occurred_on: daysAgo(1), account_id: accounts.hdfc,
    category_id: C.shopping, payment_method_id: M.GPay, merchant: 'Croma' });

  // A tab with two people and three costs carrying claims; one partly paid back.
  const people = [];
  for (const [i, name] of ['Imran Qureshi', 'Fatema Lokhandwala'].entries()) {
    const [acc] = await sql`insert into account ${sql({ id: sid(100 + i), household_id: hh, name, kind: 'person' })} returning id`;
    const [cp] = await sql`insert into counterparty ${sql({ id: sid(110 + i), household_id: hh, name, relationship: 'friend', account_id: acc.id })} returning id`;
    people.push(cp.id);
  }
  const book = sid(120);
  await sql`insert into ledger_book ${sql({ id: book, household_id: hh, name: 'Lonavala weekend' })}`;
  for (const cp of people) await sql`insert into book_member ${sql({ book_id: book, counterparty_id: cp })}`;
  const claimIds = [];
  for (const [i, [d, rupees, merchant]] of [[9, 9000, 'Villa booking'], [8, 3600, 'Petrol and tolls'], [8, 2400, 'Dinner at Sunny Dhaba']].entries()) {
    const t = await txn({ kind: 'expense', amount: rupees * 100, currency: 'INR', occurred_on: daysAgo(d),
      account_id: accounts.hdfc, category_id: C.eating, payment_method_id: M.GPay, merchant, book_id: book });
    for (const [j, cp] of people.entries()) {
      const [c] = await sql`insert into claim ${sql({ id: sid(200 + i * 2 + j), household_id: hh, kind: 'shared', counterparty_id: cp,
        expected_amount: (rupees * 100) / 3, txn_id: t })} returning id`;
      claimIds.push(c.id);
    }
  }
  // Imran pays back part of his share of the villa.
  await txn({ kind: 'claim_receipt', amount: 100000, currency: 'INR', occurred_on: daysAgo(3),
    account_id: accounts.hdfc, payment_method_id: M.GPay, claim_id: claimIds[0], merchant: 'Imran Qureshi' });

  // Schedules: a monthly expense due this week, and a monthly income.
  const dom = (d) => Math.min(28, d.getUTCDate());
  await sql`insert into schedule ${sql({ id: sid(300), household_id: hh, name: 'Broadband and cable, the family bundle plan',
    amount: 119900, account_id: accounts.hdfc, category_id: C.utilities, kind: 'expense',
    rrule: `FREQ=MONTHLY;BYMONTHDAY=${dom(inDays(3))}`, rule_since: daysAgo(40) })}`;
  await sql`insert into schedule ${sql({ id: sid(301), household_id: hh, name: 'Rental income, Pune flat',
    amount: 2200000, account_id: accounts.icici, kind: 'income', counts_as_spend: false,
    rrule: `FREQ=MONTHLY;BYMONTHDAY=${dom(inDays(5))}`, rule_since: daysAgo(40) })}`;

  const [r] = await sql`select count(*)::int as n from txn where household_id = ${hh} and id::text like ${SEED + '%'}`;
  const [cards] = await sql`select count(*)::int as n from card_bill c join account a on a.id = c.account_id
    where a.household_id = ${hh} and c.outstanding > 0`;
  return { entries: r.n, bills: cards.n };
}

console.log(`\n  ${target.name}`);
if (haveBase) console.log('  base kit already in place');
else {
  console.log(`  5 accounts · 8 categories · 5 ways to pay`);
  console.log(`  September budget ₹${(bud / 100).toLocaleString('en-IN')}`);
}
if (wealth) console.log(`  wealth: ${wealth.holdings} holdings (USD, AED, 22k gold, KWD), Sara as a second member`);
if (activity) console.log(`  activity: ${activity.entries} entries, 1 tab, 2 schedules, ${activity.bills} card bill(s) owing`);
console.log('');
await sql.end();
