/* The invariants, proved rather than assumed.
   Every case below TRIES to break a rule and expects Postgres to refuse. The
   audit of v1 found the app disagreeing with itself on arithmetic; these are
   the constraints that make that impossible, so they are worth a test each.

   Run: node scripts/invariants.test.mjs                                      */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* The invitation code is run as written, not restated: src/lib/invite-accept.ts
   takes its database handle as an argument, so the same compile the lib tests
   use lets it run here against the real schema. */
execFileSync('npx', ['tsc', '-p', 'tsconfig.lib.json'], { cwd: root, stdio: 'inherit' });
writeFileSync(join(root, '.libbuild/package.json'), '{"type":"module"}\n');
const { createFromInviteGoogleIn } = await import(pathToFileURL(join(root, '.libbuild/invite-accept.js')).href);
const { hashLinkToken, newLinkToken } = await import(pathToFileURL(join(root, '.libbuild/link-token.js')).href);
/* The same database the app runs against, as its OWNER: the app connects as
   `saree_app` (APP_DATABASE_URL), which cannot bypass row security, and a
   script that saw only one household would be no use to anyone. */
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = process.env.DATABASE_URL
  ?? /^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1]
  ?? /^APP_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1]
  ?? /^DATABASE_URL="?([^"\n]+)/m.exec(envFile)[1];
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

let pass = 0, fail = 0;
const ok = (cond, what) => { cond ? pass++ : fail++; console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}`); };

/** Expect a write to be refused. Passes only if it throws. */
async function refuses(what, fn) {
  try { await fn(); ok(false, `${what} — was ALLOWED, should have been refused`); }
  catch { ok(true, what); }
}
/** Expect a write to be refused BY THE NAMED RULE: a missing table or a typo
 *  also throws, and would pass `refuses` for the wrong reason. `why` is
 *  matched against the constraint name and the message. */
async function refusesWith(what, why, fn) {
  try { await fn(); ok(false, `${what} — was ALLOWED, should have been refused`); }
  catch (e) {
    const hit = why.test(`${e.constraint_name ?? ''} ${e.message}`);
    ok(hit, hit ? what : `${what} — refused, but not by ${why}: ${e.message.slice(0, 90)}`);
  }
}
async function allows(what, fn) {
  try { await fn(); ok(true, what); }
  catch (e) { ok(false, `${what} — was refused: ${e.message.slice(0, 80)}`); }
}

// ── a household to work in ─────────────────────────────────────────────────
// Clear anything a previous run left behind, so this is repeatable even after
// a crash. Everything below is namespaced to a test household and two phones.
const PHONES = ['+910000000001', '+910000000002', '+910000000003'];
const EMAILS = ['invited@invariant.test', 'someone.else@invariant.test',
                'passing@invariant.test', 'negative@invariant.test',
                'google.a@invariant.test', 'google.b@invariant.test',
                'google.invited@invariant.test', 'google.late@invariant.test'];
await sql`delete from household where name = 'Invariant test'`;
// A crashed run can leave reset links behind; they hold their user in place.
await sql`delete from password_reset where user_id in
  (select id from app_user where phone = any(${PHONES}) or email = any(${EMAILS}))`;
await sql`delete from app_user where phone in ${sql(PHONES)}`;
await sql`delete from app_user where email in ${sql(EMAILS)}`;

const [hh] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
const [user] = await sql`insert into app_user ${sql({ phone: '+910000000001', name: 'T' })} returning id`;
const mk = async (name, kind, extra = {}) =>
  (await sql`insert into account ${sql({ household_id: hh.id, name, kind, ...extra })} returning id`)[0].id;

const spend = await mk('HDFC Savings', 'spending');
const savings = await mk('SBI RD', 'savings');
const cash = await mk('Cash', 'cash');
const card = await mk('HDFC Regalia', 'credit', {
  statement_day: 5, due_day: 12, credit_limit: 20000000,
  bank_key: 'hdfc', card_network: 'visa', last4: '8802',
});
const [catRow] = await sql`insert into category ${sql({ household_id: hh.id, name: 'Groceries', icon: 'cart', tint: 'green' })} returning id`;
const cat = catRow.id;
// A category for what comes in: a salary files under it, and rent never can.
const [payRow] = await sql`insert into category ${sql({ household_id: hh.id, name: 'Salary', icon: 'salary', tint: 'green', scope: 'income' })} returning id`;
const pay = payRow.id;

const txn = (o) => sql`insert into txn ${sql({
  household_id: hh.id, created_by: user.id, occurred_on: '2026-09-01',
  amount: 100000, currency: 'INR', ...o })} returning id`;

console.log('\nCARD IDENTITY — only known marks, and only on credit cards');
await refuses('an unknown issuing bank is refused',
  () => sql`update account set bank_key = 'made-up-bank' where id = ${card}`);
await refuses('an unknown card network is refused',
  () => sql`update account set card_network = 'diners' where id = ${card}`);
await refuses('a bank account cannot carry credit-card identity',
  () => sql`update account set bank_key = 'hdfc', card_network = 'visa' where id = ${spend}`);
await allows('a credit card carries a known bank and network',
  () => sql`update account set bank_key = 'hdfc', card_network = 'visa' where id = ${card}`);

console.log('\nSHAPE — a move can never look like spending');
await refuses('a transfer without a second account is refused',
  () => txn({ kind: 'transfer', account_id: spend }));
await refuses('a card payment without a second account is refused',
  () => txn({ kind: 'card_payment', account_id: card }));
await refuses('an expense WITH a second account is refused',
  () => txn({ kind: 'expense', account_id: spend, counter_account_id: cash, category_id: cat }));
await refuses('a transfer carrying a category is refused',
  () => txn({ kind: 'transfer', account_id: spend, counter_account_id: savings, category_id: cat }));
await refuses('an account transferring to itself is refused',
  () => txn({ kind: 'transfer', account_id: spend, counter_account_id: spend }));
await refuses('a zero amount is refused', () => txn({ kind: 'expense', account_id: spend, amount: 0 }));
await refuses('a negative amount is refused', () => txn({ kind: 'expense', account_id: spend, amount: -1 }));
await refuses('a foreign currency without a rate is refused',
  () => txn({ kind: 'expense', account_id: spend, currency: 'USD' }));
await refuses('a refund that reverses nothing is refused',
  () => txn({ kind: 'refund', account_id: spend, category_id: cat }));

console.log('\nCURRENCY — the household\'s, unless an entry says otherwise and gives a rate');
{
  const [dirham] = await sql`insert into household ${sql({ name: 'Invariant test', base_currency: 'AED' })} returning id`;
  const wallet = (await sql`insert into account ${sql({ household_id: dirham.id, name: 'Cash', kind: 'cash', currency: 'AED' })} returning id`)[0].id;
  const put = (o) => sql`insert into txn ${sql({
    household_id: dirham.id, created_by: user.id, occurred_on: '2026-09-01', amount: 5000, ...o })} returning currency`;
  await refuses('a bad currency code on a household is refused',
    () => sql`update household set base_currency = 'rupees' where id = ${dirham.id}`);
  await allows('the currency can change while the books are empty',
    () => sql`update household set base_currency = 'SAR' where id = ${dirham.id}`);
  await sql`update household set base_currency = 'AED' where id = ${dirham.id}`;
  const [filled] = await put({ kind: 'expense', account_id: wallet });
  ok(filled.currency === 'AED', 'an entry that names no currency is in the household\'s');
  await allows('an entry in the household\'s own currency needs no rate',
    () => put({ kind: 'expense', account_id: wallet, currency: 'AED' }));
  await refuses('rupees in a dirham household need a rate',
    () => put({ kind: 'expense', account_id: wallet, currency: 'INR' }));
  await allows('rupees with a rate are fine',
    () => put({ kind: 'expense', account_id: wallet, currency: 'INR', fx_rate: 2270 }));
  await refuses('the currency cannot change once there is an entry',
    () => sql`update household set base_currency = 'USD' where id = ${dirham.id}`);
  await sql`delete from household where id = ${dirham.id}`;
}

console.log('\nCOUNTING — spend_txn is the only definition of spending');
const groceries = (await txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 234000 }))[0].id;
await txn({ kind: 'transfer', account_id: spend, counter_account_id: savings, amount: 5000000 });
await txn({ kind: 'card_payment', account_id: spend, counter_account_id: card, amount: 4285000 });
await txn({ kind: 'expense', account_id: savings, category_id: cat, amount: 900000 });
await txn({ kind: 'expense', account_id: card, category_id: cat, amount: 450000 });

/* Scoped to the test household. Without this the totals below quietly depend
   on the database holding nothing else, which stopped being true the moment
   the app had a real user in it. */
const spent = async () => Number((await sql`
  select coalesce(sum(amount),0)::bigint as t from spend_txn where household_id = ${hh.id}`)[0].t);
ok(await spent() === 234000 + 450000,
  `only the two real expenses count — ₹${(await spent()) / 100}, transfer and card payment excluded`);

await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'refund',
  amount: 50000, occurred_on: '2026-09-03', account_id: spend, category_id: cat, reverses_txn_id: groceries })}`;
ok(await spent() === 234000 + 450000 - 50000, 'a refund nets off in the month it lands');

console.log('\nCARD CYCLES — the purchase files itself, the bill clears it');
const cyc = await sql`select * from card_cycle_total where account_id = ${card}`;
ok(cyc.length === 1, 'a cycle opened itself on the first card purchase');
// Statement day is the 5th, so a 1 Sep purchase belongs to the cycle that
// opened on 6 Aug and closes on 5 Sep — not to September's.
const iso = (d) => new Date(d).toISOString().slice(0, 10);
ok(iso(cyc[0]?.period_start) === '2026-08-06' && iso(cyc[0]?.period_end) === '2026-09-05',
  `a 1 Sep purchase filed into the 6 Aug – 5 Sep cycle (got ${iso(cyc[0]?.period_start)} – ${iso(cyc[0]?.period_end)})`);
ok(iso(cyc[0]?.due_on) === '2026-09-12', 'the bill is due on the 12th, seven days after the statement');
ok(Number(cyc[0]?.charged) === 450000, 'the cycle holds exactly the card purchase');

/* Most cards are due in the month AFTER the statement — statement on the
   25th, bill due on the 10th. The due day being the smaller number is the
   common case, and it once made every purchase on such a card unsaveable:
   due_on landed before statement_on and the check refused the cycle. */
const late = await mk('Amex Platinum', 'credit', { statement_day: 25, due_day: 10 });
await allows('a purchase on a card whose due day is earlier in the month than its statement day',
  () => txn({ kind: 'expense', account_id: late, category_id: cat, amount: 99900, occurred_on: '2026-09-20' }));
const [lateCyc] = await sql`select period_end, due_on from card_cycle where account_id = ${late}`;
ok(iso(lateCyc?.period_end) === '2026-09-25' && iso(lateCyc?.due_on) === '2026-10-10',
  `its bill closes 25 Sep and is due 10 Oct (got ${iso(lateCyc?.period_end)} → ${iso(lateCyc?.due_on)})`);

/* Editing the card's days re-files what is on unpaid bills. The app does it
   by touching each entry, so the trigger reads the new days; the test does
   the same by hand and checks the filing moved. */
await sql`update account set statement_day = 15, due_day = 5 where id = ${late}`;
await sql`update txn set occurred_on = occurred_on where account_id = ${late}`;
await sql`delete from card_cycle c where c.account_id = ${late} and c.status <> 'paid'
  and not exists (select 1 from txn t where t.card_cycle_id = c.id)`;
const refiled = await sql`select period_start, period_end, due_on from card_cycle where account_id = ${late}`;
ok(refiled.length === 1 && iso(refiled[0].period_start) === '2026-09-16' && iso(refiled[0].period_end) === '2026-10-15',
  `after the statement day moves to the 15th, a 20 Sep purchase sits on the 16 Sep – 15 Oct bill (got ${refiled.map((r) => `${iso(r.period_start)} – ${iso(r.period_end)}`).join(', ')})`);
ok(refiled[0] && iso(refiled[0].due_on) === '2026-11-05', 'and that bill is due on 5 Nov');

console.log('\nBALANCES — derived from the entries, never written down');
const balanceOf = async (id) =>
  Number((await sql`select balance::bigint from account_balance where id = ${id}`)[0].balance);

// Earlier sections have already spent from these accounts, so every check here
// is relative — which is the honest way to test a derived figure anyway.
const [fresh] = await sql`insert into account ${sql({
  household_id: hh.id, name: 'Kotak Savings', kind: 'spending', opening_balance: 10000000 })} returning id`;
ok(await balanceOf(fresh.id) === 10000000,
  'an account with no entries is worth exactly its opening balance');

await txn({ kind: 'expense', account_id: fresh.id, category_id: cat, amount: 250000 });
ok(await balanceOf(fresh.id) === 9750000, 'spending ₹2,500 leaves ₹97,500');

await txn({ kind: 'income', account_id: fresh.id, category_id: pay, amount: 1000000 });
ok(await balanceOf(fresh.id) === 10750000, 'income puts it back');

/* A credit account goes NEGATIVE as you spend on it, because that is what
   owing money is. Paying the bill walks it back towards zero, and the cash for
   it leaves the bank on the same entry. */
const cardBefore = await balanceOf(card);
const bankBefore = await balanceOf(fresh.id);
await txn({ kind: 'expense', account_id: card, category_id: cat, amount: 300000 });
ok(await balanceOf(card) === cardBefore - 300000,
  'a card purchase makes the card balance more negative — that is what owing is');
await txn({ kind: 'card_payment', account_id: fresh.id, counter_account_id: card, amount: 300000 });
ok(await balanceOf(card) === cardBefore, 'paying the bill walks the card back to where it was');
ok(await balanceOf(fresh.id) === bankBefore - 300000, 'and the cash for it left the bank');

/* The bill that needs paying is the OLDEST unpaid cycle. card_open_cycle
   returns the NEWEST, which is right for "what is on this card now" and wrong
   for "what do I owe soon" — a bill due in days can hide behind a cycle that
   has only just opened. */
await txn({ kind: 'expense', account_id: card, category_id: cat,
            amount: 111000, occurred_on: '2026-10-08' });
const openCycles = await sql`select period_start, due_on from card_cycle_total
  where account_id = ${card} and status <> 'paid' order by period_start`;
ok(openCycles.length >= 2, 'a later purchase opens a second cycle while the first is unpaid');
const newest = await sql`select period_start from card_open_cycle where account_id = ${card}`;
ok(iso(newest[0].period_start) === iso(openCycles[openCycles.length - 1].period_start),
  'card_open_cycle gives the newest cycle — right for the card screen');
ok(iso(openCycles[0].period_start) !== iso(newest[0].period_start),
  'and the oldest unpaid cycle is a different one — which is the bill actually due');

/* Nothing marks a cycle paid when the card is paid, so what a bill still owes
   is derived (card_bill): payments clear the oldest bills first, and a card
   that owes nothing has no bill outstanding — however many cycles it has. */
const billOwed = async () => Number((await sql`select coalesce(sum(outstanding), 0)::bigint as s
  from card_bill where account_id = ${card}`)[0].s);
const billsByAge = async () => (await sql`select outstanding::bigint as o, charged::bigint as c
  from card_bill where account_id = ${card} order by period_start`).map((r) => [Number(r.o), Number(r.c)]);
// Earlier sections leave this card in credit; spend past that so there is a debt to clear.
await txn({ kind: 'expense', account_id: card, category_id: cat,
            amount: Math.max(0, await balanceOf(card)) + 52000, occurred_on: '2026-10-09' });
const cardDebt = Math.max(0, -(await balanceOf(card)));
ok(cardDebt > 0, 'the card owes something to clear');
const charges = (await billsByAge()).reduce((n, [, c]) => n + c, 0);
ok(await billOwed() === Math.min(cardDebt, charges), 'what the bills still owe is what the card owes');
const [payOff] = await txn({ kind: 'card_payment', account_id: fresh.id, counter_account_id: card, amount: cardDebt });
ok(await billOwed() === 0, 'paying what the card owes leaves no bill outstanding, with no cycle marked paid');
await sql`update txn set deleted_at = now() where id = ${payOff.id}`;
ok(await billOwed() === Math.min(cardDebt, charges), 'take the payment back and the bills owe again');
const ages = await billsByAge();
const newestBill = ages[ages.length - 1];
ok(newestBill[0] === Math.min(cardDebt, newestBill[1]),
  'what the card still owes sits on its NEWEST bill — payments cleared the oldest first');

console.log('\nPAYMENT METHODS — a rail is not a balance');
await refuses('a UPI method drawing on a credit card is refused',
  () => sql`insert into payment_method ${sql({ household_id: hh.id, name: 'GPay', kind: 'upi', funding_account_id: card })}`);
await refuses('a card method drawing on a bank account is refused',
  () => sql`insert into payment_method ${sql({ household_id: hh.id, name: 'Card', kind: 'card', funding_account_id: spend })}`);
await allows('UPI drawing on a spending account is allowed',
  () => sql`insert into payment_method ${sql({ household_id: hh.id, name: 'GPay', kind: 'upi', funding_account_id: spend })}`);
const [gpay] = await sql`select id from payment_method where name='GPay'`;
const [routed] = await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'expense',
  amount: 118000, occurred_on: '2026-09-02', account_id: spend, category_id: cat, payment_method_id: gpay.id })} returning account_id`;
ok(routed.account_id === spend, 'paying by GPay leaves the bank account it draws on');

console.log('\nCORRECTIONS — an edit has to move the money, not just the label');
const [upi] = await sql`select id from payment_method where household_id = ${hh.id} and name = 'GPay'`;
const [plastic] = await sql`insert into payment_method ${sql({ household_id: hh.id, name: 'Regalia',
  kind: 'card', funding_account_id: card })} returning id`;
const [edited] = await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id,
  kind: 'expense', amount: 175000, occurred_on: '2026-09-02', category_id: cat,
  payment_method_id: upi.id })} returning id, account_id, card_cycle_id`;
ok(edited.account_id === spend, 'paid by UPI, so it left the bank');
ok(edited.card_cycle_id === null, 'and it is on no card cycle');

const [moved] = await sql`update txn set payment_method_id = ${plastic.id}
  where id = ${edited.id} returning account_id, card_cycle_id`;
ok(moved.account_id === card, 'correcting it to the card MOVES the money to the card');
ok(moved.card_cycle_id !== null, 'and files it into that card\'s cycle');

const [back] = await sql`update txn set payment_method_id = ${upi.id}
  where id = ${edited.id} returning account_id, card_cycle_id`;
ok(back.account_id === spend, 'correcting it back moves the money back');
ok(back.card_cycle_id === null, 'and clears the cycle, so the card bill stops counting it');

const beforeDelete = await spent();
await sql`update txn set deleted_at = now() where id = ${edited.id}`;
ok(await spent() === beforeDelete - 175000, 'deleting an entry takes it out of the month');

console.log('\nPEOPLE — lending is a transfer, never spending');
const ahmed = await mk('Ahmed Raza', 'person');
await sql`insert into counterparty ${sql({ household_id: hh.id, name: 'Ahmed Raza', account_id: ahmed })}`;
const before = await spent();
await txn({ kind: 'transfer', account_id: spend, counter_account_id: ahmed, amount: 1000000 });
ok(await spent() === before, 'lending ₹10,000 did not touch spending');
const [bal] = await sql`select balance::bigint from counterparty_balance where name='Ahmed Raza'`;
ok(Number(bal.balance) === 1000000, 'Ahmed owes ₹10,000 — his balance is just an account balance');
await refuses('a payment method drawing on a person is refused',
  () => sql`insert into payment_method ${sql({ household_id: hh.id, name: 'Bad', kind: 'upi', funding_account_id: ahmed })}`);

/* Forgiving a debt is spending, and it is the ONLY thing that can put an
   expense on a person's account — a payment method cannot draw on one, and the
   pickers never offer one. So the three cases have to come apart cleanly. */
const beforeWriteOff = await spent();
await txn({ kind: 'transfer', account_id: ahmed, counter_account_id: spend, amount: 400000 });
ok(await spent() === beforeWriteOff, 'Ahmed paying ₹4,000 back is not spending either');
const [owed] = await sql`select balance::bigint from counterparty_balance where name='Ahmed Raza'`;
ok(Number(owed.balance) === 600000, 'and it leaves ₹6,000 still owed');

await txn({ kind: 'expense', account_id: ahmed, category_id: cat, amount: 600000 });
ok(await spent() === beforeWriteOff + 600000,
  'writing off the remaining ₹6,000 IS spending, in the month it is forgiven');
const [cleared] = await sql`select balance::bigint from counterparty_balance where name='Ahmed Raza'`;
ok(Number(cleared.balance) === 0, 'and Ahmed now owes nothing');

console.log('\nCATEGORIES — retiring one changes no figure');
const [retiring] = await sql`insert into category ${sql({ household_id: hh.id, name: 'Sundries',
  icon: 'tag', tint: 'neutral', sort_order: 99 })} returning id`;
await sql`insert into budget ${sql({ household_id: hh.id, category_id: retiring.id,
  month: '2026-09-01', amount: 300000 })}`;
await txn({ kind: 'expense', account_id: spend, category_id: retiring.id, amount: 120000 });

const budgetTotal = async () => Number((await sql`
  select coalesce(sum(amount),0)::bigint as t from budget
  where household_id = ${hh.id} and month = '2026-09-01'`)[0].t);
const beforeB = await budgetTotal(), beforeS = await spent();

await sql`update category set archived_at = now() where id = ${retiring.id}`;
ok(await budgetTotal() === beforeB, 'retiring a category leaves the month\'s budget total alone');
ok(await spent() === beforeS, 'and leaves what the month cost alone');
const [{ n: kept }] = await sql`select count(*)::int as n from txn
  where category_id = ${retiring.id} and deleted_at is null`;
ok(kept === 1, 'and the entries filed under it stay filed under it');

/* The row must still be OFFERED for that month, or the budget screen shows
   lines that do not add up to its own total — the same figure disagreeing
   with itself on one screen. */
const [{ n: shown }] = await sql`
  select count(*)::int as n from category c
  left join budget b on b.category_id = c.id and b.month = '2026-09-01'
  where c.household_id = ${hh.id} and c.id = ${retiring.id}
    and (c.archived_at is null or b.amount is not null)`;
ok(shown === 1, 'a retired category with a budget is still shown for that month');

await sql`update category set archived_at = null where id = ${retiring.id}`;

console.log('\nCLAIMS — a reimbursement is spending you expect back');
const [dinner] = await txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 200000 });
const spentAfterDinner = await spent();
const [cl] = await sql`insert into claim ${sql({ household_id: hh.id, counterparty_id:
  (await sql`select id from counterparty where name='Ahmed Raza'`)[0].id,
  txn_id: dinner.id, kind: 'reimbursement', expected_amount: 100000 })} returning id`;
ok(await spent() === spentAfterDinner,
  'claiming half of it back does NOT reduce what the month cost — you still spent it');

await refuses('a claim_receipt with no claim is refused',
  () => sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'claim_receipt',
    amount: 50000, occurred_on: '2026-09-04', account_id: spend })}`);
await refuses('an expense carrying a claim id is refused',
  () => sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'expense',
    amount: 50000, occurred_on: '2026-09-04', account_id: spend, category_id: cat, claim_id: cl.id })}`);

const state = async () => (await sql`select received::bigint, outstanding::bigint, status
  from claim_state where id = ${cl.id}`)[0];
let st = await state();
ok(Number(st.outstanding) === 100000 && st.status === 'open', 'the claim opens at ₹1,000 outstanding');

await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'claim_receipt',
  amount: 40000, occurred_on: '2026-09-05', account_id: spend, claim_id: cl.id })}`;
st = await state();
ok(Number(st.received) === 40000 && st.status === 'part_paid', 'a partial payment shows as part paid');
ok(await spent() === spentAfterDinner, 'and money coming back is still not a reduction in spending');

await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'claim_receipt',
  amount: 60000, occurred_on: '2026-09-06', account_id: spend, claim_id: cl.id })}`;
st = await state();
ok(st.status === 'settled' && Number(st.outstanding) === 0, 'the rest settles it');

/* Not "the household has no income" — it does, from an earlier section. The
   property is narrower and exact: money arriving against a claim never shows
   up as income, and never shows up as spending either. */
const [{ n: asIncome }] = await sql`
  select count(*)::int as n from income_txn where claim_id is not null`;
ok(asIncome === 0, 'money arriving against a claim is never counted as income');
const [{ n: asSpend }] = await sql`
  select count(*)::int as n from spend_txn s
  join txn t on t.id = s.id where t.claim_id is not null`;
ok(asSpend === 0, 'nor as a reduction in spending');

await sql`delete from txn where id = ${dinner.id}`;
const [{ n: left }] = await sql`select count(*)::int as n from claim where id = ${cl.id}`;
ok(left === 0, 'deleting the entry takes its claim with it — there is nothing left to be owed for');

console.log('\nTABS — owed back, and separately, whether it was yours to spend');
/* A tab raises one claim per person for their share of a cost put on it. What
   is owed back and what counted as your spending are different questions: the
   petrol you burn for work is both, the rent you front for a cousin is
   neither, and the app has to be able to say so. */
const ahmedCp = (await sql`select id, account_id from counterparty where name='Ahmed Raza' and household_id = ${hh.id}`)[0];
const zainAcc = await mk('Zain', 'person');
const [zainCp] = await sql`insert into counterparty ${sql({ household_id: hh.id, name: 'Zain', account_id: zainAcc })} returning id, account_id`;
const [office] = await sql`insert into ledger_book ${sql({ household_id: hh.id, name: 'Office' })} returning id`;
const [family] = await sql`insert into ledger_book ${sql({ household_id: hh.id, name: 'Family' })} returning id`;
const [{ n: tabCols }] = await sql`select count(*)::int as n from information_schema.columns
  where table_name = 'ledger_book' and column_name = 'counts_as_spending'`;
ok(tabCols === 0, 'a tab does NOT say whether costs on it are your spending — each entry does');
await sql`insert into book_member ${sql([{ book_id: office.id, counterparty_id: ahmedCp.id },
                                          { book_id: family.id, counterparty_id: zainCp.id }])}`;

/* Petrol on the office tab: you burned it, so it counts — and it is owed back. */
const spentBefore = await spent();
const [petrol] = await txn({ kind: 'expense', account_id: card, category_id: cat,
  amount: 300000, book_id: office.id, occurred_on: '2026-09-02' });
await sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: ahmedCp.id,
  txn_id: petrol.id, kind: 'reimbursement', expected_amount: 300000 })}`;
ok(await spent() === spentBefore + 300000,
  'a cost you bore and expect back still counts as your spending');
const [{ card_cycle_id: filed }] = await sql`select card_cycle_id from txn where id = ${petrol.id}`;
ok(filed !== null, 'and paid on a card it reaches that card’s bill like any purchase');

/* Rent fronted for family: the money left, but it was never yours to spend. */
const [rent] = await txn({ kind: 'expense', account_id: spend, category_id: cat,
  amount: 500000, book_id: family.id, counts_as_spend: false, occurred_on: '2026-09-03' });
await sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: zainCp.id,
  txn_id: rent.id, kind: 'reimbursement', expected_amount: 500000 })}`;
ok(await spent() === spentBefore + 300000,
  'a cost carried for somebody else is NOT your spending, though the money did leave');
const [{ balance: cashAfter }] = await sql`
  select balance::text from account_balance where id = ${spend}`;
const [{ balance: cashBeforeRent }] = await sql`
  select (balance + 500000)::text as balance from account_balance where id = ${spend}`;
ok(Number(cashBeforeRent) - Number(cashAfter) === 500000,
  'and the account it left is ₹5,000 lighter — a balance is the entries beneath it, whatever they count as');
const [{ n: inSpend }] = await sql`
  select count(*)::int as n from spend_txn where id = ${rent.id}`;
ok(inSpend === 0, 'spend_txn is still the only definition of spending, and it excludes it');

/* Shares divide what comes back, to the paisa, and only among the people. */
const [dinner2] = await txn({ kind: 'expense', account_id: spend, category_id: cat,
  amount: 100001, book_id: office.id, occurred_on: '2026-09-04' });
await sql`insert into claim ${sql([
  { household_id: hh.id, counterparty_id: ahmedCp.id, txn_id: dinner2.id, kind: 'reimbursement', expected_amount: 50001 },
  { household_id: hh.id, counterparty_id: zainCp.id, txn_id: dinner2.id, kind: 'reimbursement', expected_amount: 50000 },
])}`;
const [{ total: claimed2 }] = await sql`select sum(expected_amount)::bigint as total from claim where txn_id = ${dinner2.id}`;
ok(Number(claimed2) === 100001, 'the shares add back up to what is claimed, to the paisa');
await refuses('a second share for the same person on the same entry is refused',
  () => sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: ahmedCp.id, txn_id: dinner2.id, kind: 'reimbursement', expected_amount: 1 })}`);
await refuses('a share of nothing is refused',
  () => sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: zainCp.id, txn_id: petrol.id, kind: 'reimbursement', expected_amount: 0 })}`);

/* Only PART of a cost need come back. */
const [bill] = await txn({ kind: 'expense', account_id: spend, category_id: cat,
  amount: 1000000, book_id: office.id, occurred_on: '2026-09-05' });
await sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: ahmedCp.id,
  txn_id: bill.id, kind: 'reimbursement', expected_amount: 800000 })}`;
const owedOn = async (cp) => Number((await sql`
  select coalesce(outstanding, 0)::bigint as n from tab_balance
  where book_id = ${office.id} and counterparty_id = ${cp.id}`)[0]?.n ?? 0);
ok(await owedOn(ahmedCp) === 1150001,
  'what a person owes on a tab is their open shares under it — ₹3,000 + ₹500.01 + ₹8,000');

/* Money back is a receipt against a claim: not earning, and it does not
   reduce what the month cost. */
const oldest = (await sql`select cs.id from claim_state cs join txn t on t.id = cs.txn_id
  where cs.counterparty_id = ${ahmedCp.id} and t.book_id = ${office.id}
  order by t.occurred_on limit 1`)[0];
const spentNow = await spent();
await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'claim_receipt',
  amount: 300000, occurred_on: '2026-09-10', account_id: spend, claim_id: oldest.id, currency: 'INR' })}`;
ok(await owedOn(ahmedCp) === 850001, 'money back brings down exactly the claim it was paid against');
ok(await spent() === spentNow, 'and being paid back does not unspend what the month cost');
const [{ n: asIncome2 }] = await sql`
  select count(*)::int as n from income_txn where household_id = ${hh.id} and occurred_on = '2026-09-10'`;
ok(asIncome2 === 0, 'a repayment is never counted as earning');

/* Leaving the tab, and deleting it. */
await sql`delete from book_member where book_id = ${office.id} and counterparty_id = ${ahmedCp.id}`;
ok(await owedOn(ahmedCp) === 850001, 'leaving the tab leaves what they owe for earlier costs standing');
await sql`delete from ledger_book where id = ${office.id}`;
const [petrolAfter] = await sql`select book_id, deleted_at from txn where id = ${petrol.id}`;
const [{ n: sharesLeft }] = await sql`select count(*)::int as n from claim where txn_id = ${petrol.id}`;
ok(petrolAfter.book_id === null && petrolAfter.deleted_at === null && sharesLeft === 1,
  'deleting the tab takes only the tab — the entry and what is owed for it stay');

/* A tab with nobody named on it still expects the money back — the insurer,
   the office, the trip before anyone is named — so it holds the claim itself,
   and that claim counts in what is owed like any person's share. */
const [insurer] = await sql`insert into ledger_book ${sql({ household_id: hh.id, name: 'Insurer' })} returning id`;
const [surgery] = await txn({ kind: 'expense', account_id: spend, category_id: cat,
  amount: 500000, book_id: insurer.id, occurred_on: '2026-09-11' });
const [heldClaim] = await sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: null,
  txn_id: surgery.id, kind: 'reimbursement', expected_amount: 500000 })} returning id`;
const heldOn = async () => Number((await sql`
  select coalesce(sum(outstanding), 0)::bigint as n from tab_balance
  where book_id = ${insurer.id} and counterparty_id is null`)[0].n);
ok(await heldOn() === 500000, 'a cost on a tab with nobody named is owed to the tab itself');
await refuses('a second claim held by the tab on the same entry is refused',
  () => sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: null, txn_id: surgery.id, kind: 'reimbursement', expected_amount: 1 })}`);
const [loose] = await txn({ kind: 'expense', account_id: spend, category_id: cat,
  amount: 20000, occurred_on: '2026-09-11' });
await refuses('a claim with nobody named on an entry that is on no tab is refused',
  () => sql`insert into claim ${sql({ household_id: hh.id, counterparty_id: null, txn_id: loose.id, kind: 'reimbursement', expected_amount: 20000 })}`);
await sql`insert into txn ${sql({ household_id: hh.id, created_by: user.id, kind: 'claim_receipt',
  amount: 200000, occurred_on: '2026-09-12', account_id: spend, claim_id: heldClaim.id, currency: 'INR' })}`;
ok(await heldOn() === 300000, 'money back on the tab brings its own claim down');

console.log('\nRECONCILING — an adjustment moves one balance and nothing else');
/* What matching a statement may write: an adjustment in or out of one account.
   It has to move the balance — that is what it is for — and must never show
   up as spending or income, because it is neither; it is only what the books
   were missing. */
const adjBalanceOf = async (id) => Number((await sql`select balance from account_balance where id = ${id}`)[0].balance);
const balBefore = await adjBalanceOf(spend);
const spentBeforeAdj = await spent();
const [{ n: incomeBefore }] = await sql`select count(*)::int as n from income_txn where household_id = ${hh.id}`;
const [adjIn] = await txn({ kind: 'adjust_in', account_id: spend, amount: 12345, occurred_on: '2026-09-13' });
await txn({ kind: 'adjust_out', account_id: spend, amount: 345, occurred_on: '2026-09-13' });
ok(await adjBalanceOf(spend) === balBefore + 12000, 'adjustments in and out move the balance by exactly their difference');
ok(await spent() === spentBeforeAdj, 'an adjustment is never spending');
const [{ n: incomeAfter }] = await sql`select count(*)::int as n from income_txn where household_id = ${hh.id}`;
ok(incomeAfter === incomeBefore, 'an adjustment is never income');
await refuses('an adjustment cannot carry a category',
  () => txn({ kind: 'adjust_in', account_id: spend, amount: 100, category_id: cat }));
const [rec] = await sql`insert into reconciliation ${sql({ household_id: hh.id, account_id: spend,
  statement_on: '2026-09-13', statement_balance: 0 })} returning id`;
await sql`update txn set reconciled_id = ${rec.id} where id = ${adjIn.id}`;
await sql`delete from reconciliation where id = ${rec.id}`;
const [{ reconciled_id: tickAfter, deleted_at: adjGone }] = await sql`select reconciled_id, deleted_at from txn where id = ${adjIn.id}`;
ok(tickAfter === null && adjGone === null, 'removing a reconciliation clears its ticks and leaves the entries');

console.log('\nSCHEDULES — a salary comes round the way rent does');
await allows('a schedule can be income',
  () => sql`insert into schedule ${sql({ household_id: hh.id, kind: 'income', name: 'Salary', amount: 12000000,
    account_id: spend, category_id: pay, rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' })}`);
await refuses('but not a transfer — a schedule is a payment or a receipt, never a move',
  () => sql`insert into schedule ${sql({ household_id: hh.id, kind: 'transfer', name: 'Sweep', amount: 100,
    account_id: spend, rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' })}`);

console.log('\nOFFLINE — an entry that waited for signal lands once');
/* An entry recorded without signal carries a reference minted on the phone.
   Sending it twice — a retry after a reply that never arrived — must leave
   one row. The reference is scoped to the household, so two households
   minting the same one (they cannot, but the index should not care) do not
   collide either. */
const ref = '4d5b3e5c-8f1a-4a2c-9c3d-1e2f3a4b5c6d';
await allows('an entry with a client reference is accepted',
  () => txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 12300, client_ref: ref }));
await refuses('the same reference for the same household is refused',
  () => txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 12300, client_ref: ref }));
const [{ n: refRows }] = await sql`select count(*)::int as n from txn where household_id = ${hh.id} and client_ref = ${ref}`;
ok(refRows === 1, 'so exactly one row carries it');
const dupRef = await sql`insert into txn ${sql({
  household_id: hh.id, created_by: user.id, occurred_on: '2026-09-01', currency: 'INR', source: 'manual',
  kind: 'expense', account_id: spend, category_id: cat, amount: 12300, client_ref: ref,
})} on conflict (household_id, client_ref) where client_ref is not null do nothing returning id`;
ok(dupRef.length === 0, 'and the write the app makes on a retry is a silent no-op, not an error');
await allows('while entries without a reference are unlimited',
  () => txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 12300 }));

console.log('\nDUPLICATES — detected, never prevented');
const [other] = await sql`insert into app_user ${sql({ phone: '+910000000002', name: 'F' })} returning id`;
await sql`insert into member ${sql([{ household_id: hh.id, user_id: user.id, role: 'owner' },
                                    { household_id: hh.id, user_id: other.id, role: 'adult' }])}`;
await allows('the same purchase entered twice is ALLOWED — two coffees is legitimate',
  () => txn({ kind: 'expense', account_id: spend, category_id: cat, amount: 234000 }));
const dupes = await sql`select reason from duplicate_candidate where household_id = ${hh.id}`;
ok(dupes.some((d) => d.reason === 'same_account'), 'one person entering it twice is flagged');
await sql`insert into txn ${sql({ household_id: hh.id, created_by: other.id, kind: 'expense',
  amount: 234500, occurred_on: '2026-09-02', account_id: cash, category_id: cat })}`;
const two = await sql`select reason from duplicate_candidate where household_id = ${hh.id} and reason='two_people'`;
ok(two.length > 0, 'two people recording one purchase is flagged across DIFFERENT accounts');

console.log('\nBUDGETS — one row per category per month, keyed on the first');
await refuses('a budget dated mid-month is refused',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: cat, month: '2026-09-15', amount: 100 })}`);
await refuses('a negative budget is refused',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: cat, month: '2026-09-01', amount: -1 })}`);
await allows('a budget on the first is allowed',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: cat, month: '2026-09-01', amount: 2500000 })}`);
await refuses('the same category twice in one month is refused',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: cat, month: '2026-09-01', amount: 1 })}`);

console.log('\nSUBCATEGORIES — one level, and the budget line is the parent\'s');
const mkCat = (o) => sql`insert into category ${sql({ household_id: hh.id, icon: 'tag', tint: 'blue', ...o })} returning id`;
const [milk] = await mkCat({ name: 'Milk', parent_id: cat });
await refuses('a category under a child is refused — one level only',
  () => mkCat({ name: 'Buffalo milk', parent_id: milk.id }));
await refuses('a parent with children cannot move under another',
  async () => {
    const [other] = await mkCat({ name: 'Household' });
    await sql`update category set parent_id = ${other.id} where id = ${cat}`;
  });
await refuses('a category cannot be its own parent',
  () => sql`update category set parent_id = ${milk.id} where id = ${milk.id}`);
await refuses('a parent in ANOTHER household is refused',
  async () => {
    const [elsewhere] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
    const [theirs] = await sql`insert into category ${sql({ household_id: elsewhere.id, name: 'Theirs', icon: 'tag', tint: 'blue' })} returning id`;
    await sql`update category set parent_id = ${theirs.id} where id = ${milk.id}`;
  });
await refuses('a budget line on a child is refused — it rolls up into the parent',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: milk.id, month: '2026-09-01', amount: 100 })}`);
await allows('an entry files under the child itself',
  () => txn({ kind: 'expense', account_id: cash, category_id: milk.id }));

console.log('\nSCOPE — a category is for spending, for income, or for both');
await refuses('income under a category for spending is refused',
  () => txn({ kind: 'income', account_id: spend, category_id: cat }));
await refuses('spending under a category for income is refused',
  () => txn({ kind: 'expense', account_id: cash, category_id: pay }));
await refuses('a refund is spending too — not under a category for income',
  () => txn({ kind: 'refund', account_id: cash, category_id: pay }));
await refuses('a schedule for spending under a category for income is refused',
  () => sql`insert into schedule ${sql({ household_id: hh.id, kind: 'expense', name: 'Rent', amount: 100,
    account_id: spend, category_id: pay, rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' })}`);
await refuses('a scope that is not one of the three is refused',
  () => mkCat({ name: 'Odd', scope: 'sideways' }));
await refuses('a budget line on a category for income is refused — a budget limits spending',
  () => sql`insert into budget ${sql({ household_id: hh.id, category_id: pay, month: '2026-10-01', amount: 100 })}`);
const [bonus] = await mkCat({ name: 'Bonus', parent_id: pay, scope: 'expense' });
const [bonusRow] = await sql`select scope from category where id = ${bonus.id}`;
ok(bonusRow.scope === 'income', 'a child takes its parent\'s scope, whatever it asked for');
await allows('income files under the child of a category for income',
  () => txn({ kind: 'income', account_id: spend, category_id: bonus.id }));
await allows('a category for income can widen to both',
  () => sql`update category set scope = 'both' where id = ${pay}`);
const [bonusWide] = await sql`select scope from category where id = ${bonus.id}`;
ok(bonusWide.scope === 'both', 'and its children follow');
await allows('now spending files under it too',
  () => txn({ kind: 'expense', account_id: cash, category_id: bonus.id }));
await refuses('it cannot narrow back to income while spending is filed under its child',
  () => sql`update category set scope = 'income' where id = ${pay}`);
await refuses('nor to spending while income is filed under it',
  () => sql`update category set scope = 'expense' where id = ${pay}`);
await refuses('Groceries cannot become income-only — spending is filed under it',
  () => sql`update category set scope = 'income' where id = ${cat}`);
await allows('but it can be for both',
  () => sql`update category set scope = 'both' where id = ${cat}`);
await allows('and back to spending, since no income was ever filed under it',
  () => sql`update category set scope = 'expense' where id = ${cat}`);

console.log('\nACCESS — an invitation is bound to a person, not to a link');
const invited = EMAILS[0];
const mkInvite = (o = {}) => sql`insert into invite ${sql({
  household_id: hh.id, email: invited, role: 'adult', invited_by: user.id,
  token_hash: 'hash-' + Math.random().toString(36).slice(2),
  expires_at: new Date(Date.now() + 7 * 864e5), ...o })} returning id, token_hash`;

await refuses('an invite marked accepted with no time on it is refused',
  () => mkInvite({ status: 'accepted' }));
await refuses('an owner role handed out by invite is refused at the column',
  () => mkInvite({ role: 'nobody' }));
const [live] = await mkInvite();
await refuses('two invites cannot share a token',
  () => mkInvite({ token_hash: live.token_hash }));
// The plaintext token is never written down. A stolen database is a list of
// hashes, and a hash opens nothing.
const [{ n: tokenCols }] = await sql`
  select count(*)::int as n from information_schema.columns
  where table_name = 'invite' and column_name = 'token'`;
ok(tokenCols === 0, 'the invite table has no column to leak a usable link from');

/* This is the query that actually admits someone — the same shape as
   acceptInviteFor in src/db/membership.ts. What it must never do is admit on
   the strength of the token, because a link gets forwarded and screenshotted. */
const admits = async (email) => (await sql`
  select id from invite
  where lower(email) = lower(${email}) and status = 'open' and expires_at > now()`).length;

ok(await admits(invited) === 1, 'the address the invite was sent to is admitted');
ok(await admits(EMAILS[1]) === 0, 'a different address holding the same link is not admitted');

await sql`update invite set status = 'revoked' where id = ${live.id}`;
ok(await admits(invited) === 0, 'a revoked invite admits nobody, link or no link');
await sql`update invite set status = 'open', expires_at = now() - interval '1 day' where id = ${live.id}`;
ok(await admits(invited) === 0, 'an expired invite admits nobody');

console.log('\nBOOKS — one person, several sets, no leaking between them');
const [second] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
await allows('the same person can be in two households at once',
  () => sql`insert into member ${sql({ household_id: second.id, user_id: user.id, role: 'adult' })}`);
await refuses('the same person twice in ONE household is refused',
  () => sql`insert into member ${sql({ household_id: second.id, user_id: user.id, role: 'owner' })}`);
await refuses('pointing at books that do not exist is refused',
  () => sql`update app_user set active_household_id = ${user.id} where id = ${user.id}`);
await sql`update app_user set active_household_id = ${second.id} where id = ${user.id}`;
await sql`delete from household where id = ${second.id}`;
const [after] = await sql`select active_household_id from app_user where id = ${user.id}`;
ok(after.active_household_id === null,
  'deleting a household clears it from anyone still looking at it, rather than dangling');

console.log('\nACCOUNTS — a password is worth nothing without an address');
await refuses('a password on a row with no email is refused',
  () => sql`insert into app_user ${sql({ phone: '+910000000003', name: 'X', password_hash: 'scrypt$17$8$1$a$b' })}`);
await refuses('a mixed-case address is refused, so one person cannot become two accounts',
  () => sql`insert into app_user ${sql({ email: 'Invited@Invariant.Test', name: 'X' })}`);
await refuses('a negative attempt count is refused',
  () => sql`insert into app_user ${sql({ email: 'negative@invariant.test', name: 'X', failed_attempts: -1 })}`);

const [joiner] = await sql`insert into app_user ${sql({ email: invited, name: 'Invited' })} returning id`;
await allows('a reset link can be issued for a member',
  () => sql`insert into password_reset ${sql({ user_id: joiner.id, issued_by: user.id,
    token_hash: 'reset-' + Math.random().toString(36).slice(2),
    expires_at: new Date(Date.now() + 864e5) })}`);
await refuses('two reset links cannot share a token',
  () => sql`insert into password_reset ${sql([
    { user_id: joiner.id, issued_by: user.id, token_hash: 'twin', expires_at: new Date(Date.now() + 864e5) },
    { user_id: joiner.id, issued_by: user.id, token_hash: 'twin', expires_at: new Date(Date.now() + 864e5) }])}`);
const resetsBefore = (await sql`select count(*)::int as n from password_reset where user_id = ${joiner.id}`)[0].n;
ok(resetsBefore > 0, 'the reset link is on record');
await sql`insert into member ${sql({ household_id: hh.id, user_id: joiner.id, role: 'adult' })}`;
await sql`insert into txn ${sql({ household_id: hh.id, created_by: joiner.id, kind: 'expense',
  amount: 55500, occurred_on: '2026-09-03', account_id: cash, category_id: cat })}`;
const withThem = await spent();
await sql`delete from member where household_id = ${hh.id} and user_id = ${joiner.id}`;
ok(await spent() === withThem,
  'removing someone leaves what they recorded standing — the books are the household\'s');
await refuses('a member row pointing at no user is refused',
  () => sql`insert into member ${sql({ household_id: hh.id, user_id: hh.id, role: 'adult' })}`);
/* An account that has recorded entries cannot be deleted at all — the ledger
   holds it in place. This is the database half of the same rule the household
   screen states: removing someone must never change what a month cost. */
await refuses('an account that has recorded entries cannot be deleted',
  () => sql`delete from app_user where id = ${joiner.id}`);

// One that has recorded nothing can go, and takes its reset links with it.
const [passer] = await sql`insert into app_user ${sql({ email: EMAILS[2], name: 'Passing' })} returning id`;
await sql`insert into password_reset ${sql({ user_id: passer.id, issued_by: user.id,
  token_hash: 'passer-' + Math.random().toString(36).slice(2),
  expires_at: new Date(Date.now() + 864e5) })}`;
await sql`delete from app_user where id = ${passer.id}`;
const orphanResets = (await sql`select count(*)::int as n from password_reset where user_id = ${passer.id}`)[0].n;
ok(orphanResets === 0, 'deleting an account with no entries takes its reset links with it');

console.log('\nGOOGLE IDENTITY — a Google account is keyed on its sub, one per person');
{
  const [a] = await sql`insert into app_user ${sql({ email: 'google.a@invariant.test', name: 'Google A' })} returning id`;
  const [b] = await sql`insert into app_user ${sql({ email: 'google.b@invariant.test', name: 'Google B' })} returning id`;
  const link = (user_id, subject) => sql`insert into auth_identity ${sql({ user_id, provider: 'google', subject, email_at_link: 'x@invariant.test' })}`;
  await link(a.id, 'sub-1');
  await refuses('one Google account cannot belong to two people', () => link(b.id, 'sub-1'));
  await refuses('one person cannot link two Google accounts', () => link(a.id, 'sub-2'));
  await refuses('only Google is a provider',
    () => sql`insert into auth_identity ${sql({ user_id: b.id, provider: 'github', subject: 'sub-3', email_at_link: 'x@invariant.test' })}`);
  await sql`delete from app_user where id in (${a.id}, ${b.id})`;
  const left = (await sql`select count(*)::int as n from auth_identity where subject = 'sub-1'`)[0].n;
  ok(left === 0, 'deleting a person takes their linked Google account with it');
}

console.log('\nINVITED WITH GOOGLE — one transaction, one use, one place');
{
  const address = 'google.invited@invariant.test';
  const mk = async (email, extra = {}) => {
    const { token, hash } = newLinkToken();
    await sql`insert into invite ${sql({ household_id: hh.id, email, role: 'viewer', invited_by: user.id,
      token_hash: hash, expires_at: new Date(Date.now() + 7 * 864e5), ...extra })}`;
    return token;
  };
  const token = await mk(address);

  ok(await createFromInviteGoogleIn(sql, token, 'inv-sub-1', 'someone.else@invariant.test', 'X') === null,
    'a Google account for a different address cannot spend the invitation');
  const made = await createFromInviteGoogleIn(sql, token, 'inv-sub-1', address, 'Invited by Google');
  ok(!!made?.userId, 'the invited address, vouched for by Google, gets an account');
  const [m] = await sql`select count(*)::int as n, min(role::text) as role from member
    where user_id = ${made?.userId ?? null}`;
  ok(m.n === 1 && m.role === 'viewer', 'with exactly one membership, in the role the invitation named');
  const [ident] = await sql`select count(*)::int as n from auth_identity
    where user_id = ${made?.userId ?? null} and provider = 'google' and subject = 'inv-sub-1'`;
  ok(ident.n === 1, 'and their Google account linked in the same stroke');
  /* Staleness, as contextFor and the jwt callback judge it: in whole
     seconds, since that is all a token carries. The expression below is
     staleAgainst's (src/db/identity.ts), which both use. The cookie-refresh
     side of revocation is scripts/revocation.check.mjs, against a server. A token minted in the second the account was made is
     honoured; one from an earlier second than a revocation is refused. */
  const stale = async (id, iat) => (await sql`
    select extract(epoch from date_trunc('second', u.sessions_valid_from)) > ${iat} as stale
    from app_user u where u.id = ${id}`)[0].stale;
  const [{ born }] = await sql`select floor(extract(epoch from sessions_valid_from))::bigint::int as born
    from app_user where id = ${made?.userId ?? null}`;
  const [{ recent }] = await sql`select sessions_valid_from > now() - interval '1 minute' as recent
    from app_user where id = ${made?.userId ?? null}`;
  ok(recent === true, 'the new account starts its session epoch at now(), like every other');
  ok(await stale(made?.userId, born) === false,
    'a session minted in the same second the account was made is honoured, not signed out on arrival');
  await sql`update app_user set sessions_valid_from = now() where id = ${made?.userId ?? null}`;
  const [{ revoked }] = await sql`select floor(extract(epoch from sessions_valid_from))::bigint::int as revoked
    from app_user where id = ${made?.userId ?? null}`;
  ok(await stale(made?.userId, revoked - 1) === true,
    'a session from an earlier second than a revocation is refused');
  ok(await stale(made?.userId, revoked) === false,
    'and one minted in the revocation\'s own second, after it, is honoured');
  const [spent] = await sql`select status from invite where token_hash = ${hashLinkToken(token)}`;
  ok(spent.status === 'accepted', 'and the invitation spent');
  ok(await createFromInviteGoogleIn(sql, token, 'inv-sub-2', address, 'Again') === null,
    'a second use of the same invitation is refused');
  const [people] = await sql`select count(*)::int as n from app_user where email = ${address}`;
  ok(people.n === 1, 'and made nobody');

  const late = await mk('google.late@invariant.test', { expires_at: new Date(Date.now() - 864e5) });
  ok(await createFromInviteGoogleIn(sql, late, 'inv-sub-3', 'google.late@invariant.test', 'Late') === null,
    'an expired invitation admits nobody');
  const withdrawn = await mk('google.late@invariant.test', { status: 'revoked' });
  ok(await createFromInviteGoogleIn(sql, withdrawn, 'inv-sub-3', 'google.late@invariant.test', 'Late') === null,
    'nor does a withdrawn one');
  const [none] = await sql`select count(*)::int as n from app_user where email = 'google.late@invariant.test'`;
  ok(none.n === 0, 'and neither leaves an account behind');
  await sql`delete from invite where household_id = ${hh.id} and email in ${sql([address, 'google.late@invariant.test'])}`;
}

console.log('\nROW SECURITY — Postgres itself refuses another household\'s rows');
/* The catalogue first: every table keyed by a household is under a policy,
   every view runs as its caller, and the set left open is exactly the
   tables keyed by a person or a token. */
{
  const rels = await sql`
    select c.relname as name, c.relkind as kind, c.relrowsecurity as rls, c.relforcerowsecurity as force,
      (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies,
      coalesce(c.reloptions::text[] @> array['security_invoker=true'], false) as invoker,
      exists (select 1 from information_schema.columns k
        where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'household_id') as keyed
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v') order by c.relname`;
  const tables = rels.filter((r) => r.kind === 'r'), views = rels.filter((r) => r.kind === 'v');
  const children = ['book_member', 'card_cycle', 'claim_item', 'occurrence', 'duplicate_dismissed'];
  const covered = (r) => r.rls && r.force && r.policies > 0;
  const unguarded = tables.filter((r) => (r.keyed || r.name === 'household' || children.includes(r.name)) && !covered(r));
  ok(unguarded.length === 0,
    `every table keyed by a household, and every child of one, is under a forced policy${unguarded.length ? ': not ' + unguarded.map((r) => r.name).join(', ') : ''}`);
  const open = tables.filter((r) => !covered(r)).map((r) => r.name).sort().join(' ');
  // price_quote is a market price, the same for everyone: no household, no policy.
  ok(open === '_migration app_user auth_identity device password_reset price_quote rate_limit',
    `the tables left open are exactly the ones keyed by a person or a token (${open})`);
  const blind = views.filter((v) => !v.invoker).map((v) => v.name);
  ok(views.length >= 13 && blind.length === 0,
    `all ${views.length} views run as their caller${blind.length ? ' — not ' + blind.join(', ') : ''}`);
}

/* Then the app's own role, on the string the app reads. Its BYPASSRLS would
   make every policy above decorative, so that is the first check. */
const appUrl = /^APP_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1];
const appUser = (() => { try { return new URL(appUrl).username; } catch { return null; } })();
ok(appUser === 'saree_app', `APP_DATABASE_URL connects as saree_app${appUser ? '' : ' — run scripts/app-role.mjs'}`);
if (appUser === 'saree_app') {
  const app = postgres(appUrl, { ssl: 'require', max: 1, onnotice: () => {} });
  const [role] = await app`select r.rolbypassrls as bypass, r.rolsuper as super,
    exists (select 1 from pg_class c where c.relowner = r.oid) as owns
    from pg_roles r where r.rolname = current_user`;
  ok(!role.bypass && !role.super && !role.owns, 'the app role cannot bypass a policy and owns nothing');

  // A second household with an entry of its own, so there is something to fail to see.
  const [other] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
  const otherAcct = (await sql`insert into account ${sql({ household_id: other.id, name: 'Theirs', kind: 'cash' })} returning id`)[0].id;
  const [otherCat] = await sql`insert into category ${sql({ household_id: other.id, name: 'Theirs', icon: 'tag', tint: 'blue' })} returning id`;
  const [otherTxn] = await sql`insert into txn ${sql({ household_id: other.id, created_by: user.id, occurred_on: '2026-09-01',
    amount: 5000, currency: 'INR', kind: 'expense', account_id: otherAcct, category_id: otherCat.id })} returning id`;
  const mine = (await sql`select count(*)::int as n from txn where household_id = ${hh.id}`)[0].n;

  const count = (q) => q.then((r) => r[0].n);
  ok(await count(app`select count(*)::int as n from txn`) === 0,
    'with no household named, the ledger is empty');
  ok(await count(app`select count(*)::int as n from household where id = ${hh.id}`) === 1,
    'with no household named, a household can still be found — that is how sign-in finds it');
  ok((await app`select app_household() as h`)[0].h === null, 'the setting is null until a transaction names it');

  const scoped = (id, fn) => app.begin(async (tx) => {
    await tx`select set_config('app.household_id', ${id}, true)`;
    return fn(tx);
  });
  ok(await scoped(hh.id, (tx) => count(tx`select count(*)::int as n from txn where household_id = ${hh.id}`)) === mine && mine > 0,
    `named, the household sees its own entries (${mine})`);
  ok(await scoped(hh.id, (tx) => count(tx`select count(*)::int as n from txn where household_id = ${other.id}`)) === 0,
    'named, it sees none of another household\'s — the query asked for them by id');
  ok(await scoped(hh.id, (tx) => count(tx`select count(*)::int as n from spend_txn where household_id = ${other.id}`)) === 0,
    'nor through a view');
  ok(await scoped(hh.id, (tx) => count(tx`select count(*)::int as n from household where id = ${other.id}`)) === 0,
    'nor the other household\'s own row');
  ok(await scoped(hh.id, (tx) => tx`update txn set note = 'x' where id = ${otherTxn.id}`.then((r) => r.count)) === 0,
    'an update aimed at another household\'s entry touches nothing');
  await refuses('an insert into another household is refused',
    () => scoped(hh.id, (tx) => tx`insert into txn ${sql({ household_id: other.id, created_by: user.id, occurred_on: '2026-09-01',
      amount: 5000, currency: 'INR', kind: 'expense', account_id: otherAcct, category_id: otherCat.id })}`));
  await refuses('a child row under another household\'s parent is refused',
    () => scoped(hh.id, (tx) => tx`insert into card_cycle ${sql({ account_id: otherAcct, period_start: '2026-09-01',
      period_end: '2026-09-30', statement_on: '2026-09-30', due_on: '2026-10-10' })}`));
  await allows('the same insert into its own household goes through',
    () => scoped(hh.id, (tx) => tx`insert into txn ${sql({ household_id: hh.id, created_by: user.id, occurred_on: '2026-09-01',
      amount: 5000, currency: 'INR', kind: 'expense', account_id: cash, category_id: cat })}`));
  await refuses('a setting that is not a household id fails closed rather than open',
    () => scoped('not-a-household', (tx) => tx`select count(*) from txn`));
  ok((await app`select app_household() as h`)[0].h === null,
    'and the setting is gone once the transaction is — it cannot leak onto a pooled connection');
  await app.end();
  const seen = (await sql`select count(*)::int as n from txn where household_id = ${other.id}`)[0].n;
  ok(seen === 1, 'the owner, running this test, still sees everything');
}

console.log('\nWEALTH — owners, pots and metals, valued once, in SQL, half-even');
/* Holdings are snapshots, never entries: no view the budget or a balance
   reads may mention them. Prices: `price_quote` is global and real
   households read it, so every quote written here is for XTS — the ISO code
   reserved for testing, which no household holds — and is deleted after.
   The valuation figures use household overrides, which go with the
   household. */
await sql`delete from price_quote where base = 'XTS'`.catch(() => {});
try {
  const [{ today, yesterday, tomorrow }] = await sql`select current_date::text as today,
    (current_date - 1)::text as yesterday, (current_date + 1)::text as tomorrow`;
  const [stranger] = await sql`insert into app_user ${sql({ phone: '+910000000003', name: 'Not a member' })} returning id`;

  // Ownership: NULL is joint; an owner must be in the household; a person account has none.
  await allows('an account can belong to a member', () => sql`update account set owner_user_id = ${user.id} where id = ${cash}`);
  await refusesWith('an owner who is not a member is refused', /member/i,
    () => sql`update account set owner_user_id = ${stranger.id} where id = ${spend}`);
  await refusesWith('an owner on a person account is refused', /person_has_no_owner/,
    () => sql`insert into account ${sql({ household_id: hh.id, name: 'Ahmed', kind: 'person', owner_user_id: user.id })}`);
  await sql`update account set owner_user_id = null where id = ${cash}`;
  const [bal] = await sql`select owner_user_id from account_balance where id = ${cash}`;
  ok(bal && 'owner_user_id' in bal, 'account_balance carries the owner');

  const pot = async (o) => (await sql`insert into holding ${sql({ household_id: hh.id, kind: 'fx_cash', name: 'Pot', ...o })} returning id`)[0].id;
  const snap = (holding, quantity, as_of = today) =>
    sql`insert into holding_snapshot ${sql({ holding_id: holding, household_id: hh.id, as_of, quantity, created_by: user.id })}`;
  const override = (base, rate, as_of = today) =>
    sql`insert into price_override ${sql({ household_id: hh.id, base, quote: 'INR', as_of, rate, set_by: user.id })}`;
  const valued = async (id) => (await sql`select quantity::bigint as q, as_of::text as as_of, rate::text as rate, rate_as_of::text as rate_as_of,
    rate_source, value_minor from holding_value where id = ${id}`)[0];

  await refusesWith('an INR pot in an INR household is refused, naming the code', /Use an account for INR/,
    () => pot({ currency: 'INR' }));
  await refusesWith('a pot owned by someone outside the household is refused', /member/i,
    () => pot({ currency: 'USD', owner_user_id: stranger.id }));
  await refusesWith('a pot cannot carry a metal', /holding_shape/,
    () => pot({ currency: 'USD', metal: 'gold', purity_permille: 916 }));
  await refusesWith('a metal needs a purity between 1 and 1000', /holding_shape/,
    () => sql`insert into holding ${sql({ household_id: hh.id, kind: 'metal', name: 'Bar', metal: 'gold', purity_permille: 1001 })}`);

  const kwd = await pot({ currency: 'KWD', name: 'Kuwait cash', owner_user_id: user.id });
  ok(Number((await sql`select count(*)::int as n from holding_value where id = ${kwd}`)[0].n) === 1, 'a new pot is in holding_value');
  const before = await valued(kwd);
  ok(before.q === null && before.value_minor === null, 'with no snapshot, value_minor is NULL — not zero');
  await refusesWith('a negative snapshot is refused', /quantity_not_negative/, () => snap(kwd, -1));
  await snap(kwd, 1500);
  await refusesWith('two snapshots on one day for one holding are refused', /one_a_day/, () => snap(kwd, 1600));
  const [elsewhere] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
  await refusesWith('a snapshot filed under another household than its holding is refused', /same_household/,
    () => sql`insert into holding_snapshot ${sql({ holding_id: kwd, household_id: elsewhere.id, as_of: yesterday, quantity: 1 })}`);

  ok((await valued(kwd)).value_minor === null, 'with a snapshot but no rate, value_minor is NULL');
  await snap(kwd, 9999, tomorrow);
  const fut = await valued(kwd);
  ok(Number(fut.q) === 1500 && fut.as_of === today,
    `a snapshot dated tomorrow does not stand in for today's (${fut.q} on ${fut.as_of})`);
  await refusesWith('a rate of zero is refused on an override', /rate_positive/, () => override('KWD', 0));
  await refusesWith('an absurd rate is refused on an override, before it can overflow a value', /rate_bounded/,
    () => override('KWD', '1000000000'));
  await refusesWith('and on a quote', /rate_bounded/,
    () => sql`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: today, rate: '1000000000', source: 'test' })}`);
  await refusesWith('a negative rate is refused on a quote', /rate_positive/,
    () => sql`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: today, rate: -1, source: 'test' })}`);
  await override('KWD', '271.5');
  const k = await valued(kwd);
  ok(String(k.value_minor) === '40725' && Number(k.q) === 1500,
    `KD 1.500 at 271.5 is ₹407.25 — 40725 paise, from today's snapshot not tomorrow's (${k.q} → ${k.value_minor})`);

  const jpy = await pot({ currency: 'JPY', name: 'Yen' });
  await snap(jpy, 500); await override('JPY', '0.55');
  ok(String((await valued(jpy)).value_minor) === '27500', `¥500 at 0.55 is 27500 paise (${(await valued(jpy)).value_minor})`);

  const [gold] = await sql`insert into holding ${sql({ household_id: hh.id, kind: 'metal', name: 'Bangles',
    metal: 'gold', purity_permille: 916 })} returning id`;
  await snap(gold.id, 50000); await override('XAU', '8000');
  ok(String((await valued(gold.id)).value_minor) === '36640000',
    `50 g of 22k gold at ₹8,000/g pure is 36640000 paise (${(await valued(gold.id)).value_minor})`);

  // A quote alone is used; an override newer than the latest quote beats it.
  const xts0 = await pot({ currency: 'XTS', name: 'Quote only' });
  await snap(xts0, 100);
  await sql`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: yesterday, rate: '5', source: 'invariant-test' })}`;
  let x0 = await valued(xts0);
  ok(x0.rate_source === 'invariant-test' && Number(x0.rate) === 5 && x0.rate_as_of === yesterday && String(x0.value_minor) === '500',
    `with only a quote and no override, the quote is used (${x0.rate_source} ${x0.rate} → ${x0.value_minor})`);
  await override('XTS', '6', today);
  x0 = await valued(xts0);
  ok(x0.rate_source === 'override' && Number(x0.rate) === 6 && x0.rate_as_of === today && String(x0.value_minor) === '600',
    `an override dated today beats a quote dated yesterday (${x0.rate_source} ${x0.rate} → ${x0.value_minor})`);
  await sql`delete from price_override where household_id = ${hh.id} and base = 'XTS'`;
  await sql`delete from price_quote where base = 'XTS'`;
  await sql`delete from holding where id = ${xts0}`;

  // Which rate applies: newest of override and quote, the override winning a tie; nothing after today.
  const xts = await pot({ currency: 'XTS', name: 'Test pot' });
  await snap(xts, 100);
  await sql`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: today, rate: '2', source: 'invariant-test' })}`;
  await sql`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: tomorrow, rate: '9', source: 'invariant-test' })}`;
  await override('XTS', '4', yesterday);
  let x = await valued(xts);
  ok(x.rate_source === 'invariant-test' && Number(x.rate) === 2 && x.rate_as_of === today && String(x.value_minor) === '200',
    `a quote dated today beats an override dated yesterday, and tomorrow's quote is not used (${x.rate_source} ${x.rate} → ${x.value_minor})`);
  await override('XTS', '3', today);
  x = await valued(xts);
  ok(x.rate_source === 'override' && Number(x.rate) === 3 && String(x.value_minor) === '300',
    `an override dated today beats a quote dated today (${x.rate_source} ${x.rate} → ${x.value_minor})`);

  // Banker's rounding, once, at the end.
  const r = (await sql`select round_half_even(0.5) a, round_half_even(1.5) b, round_half_even(2.5) c,
    round_half_even(-0.5) d, round_half_even(-1.5) e, round_half_even(2.4999999999) f, round_half_even(2.5000000001) g`)[0];
  ok([r.a, r.b, r.c, r.d, r.e, r.f, r.g].map(String).join(' ') === '0 2 2 0 -2 2 3',
    `round_half_even: 0.5→0 1.5→2 2.5→2 -0.5→0 -1.5→-2, and only an exact half is a tie (${[r.a, r.b, r.c, r.d, r.e, r.f, r.g].join(' ')})`);
  const half = await pot({ currency: 'KWD', name: 'Half' });
  await snap(half, 5); // 0.005 KD × 271.5 = ₹1.3575 → 135.75 paise → 136
  ok(String((await valued(half)).value_minor) === '136', 'a value is rounded to the nearest paisa');
  await sql`update holding_snapshot set quantity = 1 where holding_id = ${half}`; // 27.15 → 27
  ok(String((await valued(half)).value_minor) === '27', 'and down when nearer down');
  const [silver] = await sql`insert into holding ${sql({ household_id: hh.id, kind: 'metal', name: 'Coin',
    metal: 'silver', purity_permille: 1000 })} returning id`;
  await override('XAG', '25');
  await snap(silver.id, 1); // 1 mg pure × ₹25/g = 2.5 paise, an exact tie
  ok(String((await valued(silver.id)).value_minor) === '2', 'an exact half paisa goes to the even one: 2.5 → 2');
  await sql`update holding_snapshot set quantity = 3 where holding_id = ${silver.id}`; // 7.5 → 8
  ok(String((await valued(silver.id)).value_minor) === '8', 'and 7.5 → 8');

  // What updateSnapshot writes: one figure a day, and a second save that day replaces it.
  const upsert = (holding, quantity, as_of = today) => sql`
    insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
    values (${holding}, ${hh.id}, ${as_of}, ${quantity}, ${user.id})
    on conflict (holding_id, as_of) do update set quantity = excluded.quantity, created_by = excluded.created_by`;
  await upsert(kwd, 2000);
  const nKwd = (await sql`select count(*)::int as n from holding_snapshot where holding_id = ${kwd} and as_of = ${today}`)[0].n;
  ok(nKwd === 1 && Number((await valued(kwd)).q) === 2000 && String((await valued(kwd)).value_minor) === '54300',
    `a second save on the same day replaces the figure (${nKwd} row, KD 2.000 at 271.5 → ${(await valued(kwd)).value_minor})`);
  await upsert(kwd, 1500);
  await upsert(kwd, 1700, yesterday);
  ok((await sql`select count(*)::int as n from holding_snapshot where holding_id = ${kwd}`)[0].n === 3,
    'a different day adds a figure instead (today, yesterday, and the one dated tomorrow)');
  // An override saved twice on one day is one row: the later save wins (setRateOverride's upsert).
  const setOverride = (base, rate, as_of = today) => sql`
    insert into price_override (household_id, base, quote, as_of, rate, set_by) values (${hh.id}, ${base}, 'INR', ${as_of}, ${rate}, ${user.id})
    on conflict (household_id, base, quote, as_of) do update set rate = excluded.rate, set_by = excluded.set_by, set_at = now()`;
  await setOverride('KWD', '280.25'); await setOverride('KWD', '271.5');
  ok((await sql`select count(*)::int as n from price_override where household_id = ${hh.id} and base = 'KWD' and as_of = ${today}`)[0].n === 1
     && String((await valued(kwd)).value_minor) === '40725', 'an override set twice on one day is one row, the later one');
  await refusesWith('a rate of zero through the same upsert is refused by the CHECK', /rate_positive/, () => setOverride('KWD', '0'));
  await refusesWith('a rate of ten decimals plus a billion is refused by the CHECK', /rate_bounded/, () => setOverride('KWD', '1000000000.5'));

  // holding_value_at is holding_value for any date; for today they agree on every holding.
  const mism = await sql`select v.id, f.id as fid from holding_value v
    full join holding_value_at(${hh.id}, current_date) f on f.id = v.id
    where coalesce(v.household_id, ${hh.id}) = ${hh.id}
      and (v.id is null or f.id is null or v.value_minor is distinct from f.value_minor)`;
  const total = (await sql`select count(*)::int as n from holding_value where household_id = ${hh.id}`)[0].n;
  const totalAt = (await sql`select count(*)::int as n from holding_value_at(${hh.id}, current_date)`)[0].n;
  ok(total >= 6 && totalAt === total && mism.length === 0,
    `holding_value_at(today) equals holding_value for all ${total} holdings, ties, quotes, overrides and nulls included`);
  const at = async (id, d) => (await sql`select value_minor::text as v from holding_value_at(${hh.id}, ${d}::date) where id = ${id}`)[0]?.v ?? 'missing';
  await upsert(xts, 100, yesterday);
  ok(await at(xts, yesterday) === '400', 'on yesterday, the override dated yesterday is the rate: 100 × 4 = 400 (today\'s quote is not yet known)');
  ok(await at(xts, today) === '300', 'on today, the override dated today beats the quote dated today');
  ok((await sql`select value_minor from holding_value_at(${hh.id}, ${yesterday}::date) where id = ${kwd}`)[0].value_minor === null,
    'a holding with a figure but no rate yet that day is valued NULL, not zero');
  ok((await sql`select value_minor from holding_value_at(${hh.id}, '2000-01-01'::date) where id = ${gold.id}`)[0].value_minor === null,
    'before its first snapshot a holding has no value');
  ok((await sql`select count(*)::int as n from holding_value_at(${elsewhere.id}, current_date)`)[0].n === 0,
    'a household with no holdings gets no rows');
  const keyed = await sql`select count(*)::int as n from holding_value_at(${elsewhere.id}, current_date) f join holding h on h.id = f.id where h.household_id = ${hh.id}`;
  ok(keyed[0].n === 0, 'and asking for another household returns none of this one\'s');

  // The expression worthSeries uses: the current month's point is today's figure, and last month's is its own month-end.
  const point = async (month) => (await sql`
    select coalesce((select sum(v.value_minor) from holding_value_at(${hh.id},
             least((${month}::date + interval '1 month - 1 day')::date, current_date)) v
           where v.archived_at is null or v.archived_at >= (${month}::date + interval '1 month')::date), 0)::text as holdings`)[0].holdings;
  const nowSum = (await sql`select coalesce(sum(value_minor), 0)::text as s from holding_value where household_id = ${hh.id} and archived_at is null`)[0].s;
  ok(await point((await sql`select date_trunc('month', current_date)::date::text as m`)[0].m) === nowSum,
    `worthSeries' holdings point for this month is today's holdings total (${nowSum})`);
  ok(await point('2000-01-01') === '0', 'and a month before any snapshot is 0');

  // A past date against a hand-computed set: snapshots 200 (5 days ago) and 300 (2 days ago), rates 2 (5 days ago) and 3 (yesterday).
  const d = async (n) => (await sql`select (current_date - ${n}::int)::text as d`)[0].d;
  const hist = await pot({ currency: 'XTS', name: 'History' });
  await upsert(hist, 200, await d(5)); await upsert(hist, 300, await d(2));
  await setOverride('XTS', '2', await d(5)); await setOverride('XTS', '3', await d(1));
  const want = [[6, 'null'], [5, '400'], [3, '400'], [2, '600'], [1, '900'], [0, '900']];
  const got = [];
  for (const [n] of want) got.push([n, String((await sql`select value_minor::text as v from holding_value_at(${hh.id}, ${await d(n)}::date) where id = ${hist}`)[0].v)]);
  ok(JSON.stringify(got) === JSON.stringify(want), `a past date's value is the hand-computed one: ${got.map((g) => g.join('→')).join(' ')}`);
  ok(String((await valued(hist)).value_minor) === '900', 'and today agrees with holding_value');

  // Archiving never rewrites history: a holding live last month stays in last month's point and leaves this month's.
  const lm = (await sql`select (date_trunc('month', current_date) - interval '1 month')::date::text as m, date_trunc('month', current_date)::date::text as c`)[0];
  const old = await pot({ currency: 'XTS', name: 'Archived later' });
  await upsert(old, 1000, lm.m); await setOverride('XTS', '2', lm.m);
  await sql`delete from price_override where household_id = ${hh.id} and base = 'XTS' and as_of in (${await d(5)}, ${await d(1)})`;
  const lastBefore = await point(lm.m), thisBefore = await point(lm.c);
  await sql`update holding set archived_at = now() where id = ${old}`;
  const lastAfter = await point(lm.m), thisAfter = await point(lm.c);
  ok(Number(lastBefore) >= 2000 && lastAfter === lastBefore, `archiving leaves last month's point unchanged (${lastBefore} → ${lastAfter})`);
  const oldNow = Number((await valued(old)).value_minor);
  ok(oldNow > 0 && Number(thisBefore) - Number(thisAfter) === oldNow,
    `and today's point drops it (${thisBefore} → ${thisAfter})`);

  // Digits come from the same list as money.ts.
  const digits = await sql`select code, currency_digits(code) as d from unnest(
    array['INR','KWD','BHD','OMR','JOD','IQD','TND','JPY','KRW','VND','UGX','USD','IDR']) as code`;
  ok(digits.map((d) => `${d.code}${d.d}`).join(' ') === 'INR2 KWD3 BHD3 OMR3 JOD3 IQD3 TND3 JPY0 KRW0 VND0 UGX0 USD2 IDR2',
    `currency_digits agrees with lib/money.ts (${digits.map((d) => `${d.code}${d.d}`).join(' ')})`);

  // No float near the money.
  const floats = await sql`select a.attname from pg_attribute a join pg_class c on c.oid = a.attrelid
    where c.relname in ('holding','holding_snapshot','price_quote','price_override','holding_value')
      and a.attnum > 0 and a.atttypid in ('float4'::regtype, 'float8'::regtype)`;
  ok(floats.length === 0, 'no float column in holdings, prices or their valuation');
  const [vm] = await sql`select format_type(atttypid, atttypmod) t from pg_attribute
    where attrelid = 'holding_value'::regclass and attname = 'value_minor'`;
  ok(vm?.t === 'bigint', `value_minor is a bigint of minor units (${vm?.t})`);

  // Snapshots, never entries: nothing the budget or a balance reads mentions them.
  const named = await sql`select viewname from pg_views where schemaname = 'public'
    and viewname in ('spend_txn','income_txn','account_balance') and definition !~ '(holding|price_)'`;
  ok(named.length === 3, 'spend_txn, income_txn and account_balance do not read holdings or prices');
  const readers = await sql`select viewname from pg_views where schemaname = 'public'
    and viewname <> 'holding_value' and definition ~ '(holding|price_)'`;
  ok(readers.length === 0, `no other view reads them either${readers.length ? ': ' + readers.map((v) => v.viewname).join(', ') : ''}`);

  // A household's base cannot become the currency of a pot it holds.
  const [aed] = await sql`insert into household ${sql({ name: 'Invariant test', base_currency: 'AED' })} returning id`;
  await sql`insert into holding ${sql({ household_id: aed.id, kind: 'fx_cash', name: 'Dollars', currency: 'USD' })}`;
  await refusesWith('a household cannot move its books into the currency of one of its pots', /Use an account for USD: a pot already holds it/,
    () => sql`update household set base_currency = 'USD' where id = ${aed.id}`);

  console.log('\nHOLDING PHOTOS — a valuation slip, the jewellery on the scale');
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
  const photo = (o = {}) => sql`insert into holding_attachment ${sql({
    household_id: hh.id, holding_id: kwd, name: 'slip.jpg', mime: 'image/jpeg', bytes: JPEG.length, data: JPEG,
    created_by: user.id, ...o })} returning id`;
  const [kwdSnap] = await sql`select id from holding_snapshot where holding_id = ${kwd} limit 1`;
  const [goldSnap] = await sql`select id from holding_snapshot where holding_id = ${gold.id} limit 1`;
  ok(!!kwdSnap && !!goldSnap, 'two holdings, each with a snapshot, to hang photos on');
  await allows('a photo can belong to the holding itself (snapshot NULL)', () => photo());
  await allows('or be evidence for one of its own snapshots', () => photo({ snapshot_id: kwdSnap.id }));
  for (const mime of ['image/png', 'image/webp', 'application/pdf']) {
    await allows(`${mime} is kept`, () => photo({ mime }));
  }
  await allows('exactly 2 MB is kept', () => photo({ bytes: 2097152, data: Buffer.alloc(2097152, 1) }));
  await refusesWith('a photo over 2 MB is refused', /holding_attachment_size/,
    () => photo({ bytes: 2097153, data: Buffer.alloc(2097153, 1) }));
  await refusesWith('an empty photo is refused', /holding_attachment_size/, () => photo({ bytes: 0, data: Buffer.alloc(0) }));
  for (const mime of ['image/gif', 'text/html', 'image/svg+xml', 'IMAGE/JPEG']) {
    await refusesWith(`${mime} is refused`, /holding_attachment_mime/, () => photo({ mime }));
  }
  await refusesWith('a snapshot of ANOTHER holding is refused', /holding_attachment_snapshot_same_holding/,
    () => photo({ snapshot_id: goldSnap.id }));
  await refusesWith('a holding of another household is refused (composite key)', /holding_attachment_same_household/,
    () => photo({ household_id: elsewhere.id }));
  await refusesWith('a photo needs a holding', /null value|holding_id/, () => photo({ holding_id: null }));
  ok(Number((await sql`select count(*)::int as n from holding_attachment where holding_id = ${kwd}`)[0].n) === 6,
    'only the six valid photos were stored');
  const swept = await sql`select count(*)::int as n from pg_policies where tablename = 'holding_attachment'`;
  ok(swept[0].n === 1, 'holding_attachment is under a household policy');
  // Replacing a day's figure keeps the snapshot row, so its photos stay attached.
  await sql`insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
    select holding_id, household_id, as_of, quantity + 1, created_by from holding_snapshot where id = ${kwdSnap.id}
    on conflict (holding_id, as_of) do update set quantity = excluded.quantity`;
  ok(Number((await sql`select count(*)::int as n from holding_attachment where snapshot_id = ${kwdSnap.id}`)[0].n) === 1,
    'saving the day\'s figure again leaves its photo attached');
  const [{ id: gonePhoto }] = await photo({ holding_id: gold.id, snapshot_id: goldSnap.id });
  await sql`delete from holding where id = ${gold.id}`;
  ok(Number((await sql`select count(*)::int as n from holding_attachment where id = ${gonePhoto}`)[0].n) === 0,
    'deleting a holding takes its photos (archiving, which the app uses, keeps them)');

  // Row security, as the app.
  if (appUser === 'saree_app') {
    const app = postgres(appUrl, { ssl: 'require', max: 1, onnotice: () => {} });
    const scoped = (id, fn) => app.begin(async (tx) => {
      await tx`select set_config('app.household_id', ${id}, true)`;
      return fn(tx);
    });
    const n = (q) => q.then((rows) => rows[0].n);
    ok(await scoped(hh.id, (tx) => n(tx`select count(*)::int as n from holding where id = ${kwd}`)) === 1,
      'named, the household sees its own pot');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding where id = ${kwd}`)) === 0,
      'another household cannot read the holding, asked for by id');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding_snapshot where holding_id = ${kwd}`)) === 0,
      'nor its snapshots');
    ok(await scoped(hh.id, (tx) => n(tx`select count(*)::int as n from holding_attachment where holding_id = ${kwd}`)) === 6,
      'named, the household sees its own photos');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding_attachment where holding_id = ${kwd}`)) === 0,
      'another household cannot read its photos, asked for by holding');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding_attachment`)) === 0,
      'nor list any photo at all');
    await refusesWith('another household cannot write a photo onto it', /row-level security|same_household/,
      () => scoped(elsewhere.id, (tx) => tx`insert into holding_attachment ${sql({ household_id: hh.id, holding_id: kwd,
        name: 'x', mime: 'image/png', bytes: 1, data: Buffer.from([1]) })}`));
    await refusesWith('nor write one under its own id onto this holding', /same_household/,
      () => scoped(elsewhere.id, (tx) => tx`insert into holding_attachment ${sql({ household_id: elsewhere.id, holding_id: kwd,
        name: 'x', mime: 'image/png', bytes: 1, data: Buffer.from([1]) })}`));
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from price_override where household_id = ${hh.id}`)) === 0,
      'nor its overrides');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding_value where household_id = ${hh.id}`)) === 0,
      'nor through holding_value');
    ok(await n(app`select count(*)::int as n from holding`) === 0, 'unscoped, there are no holdings at all');
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from holding_value_at(${hh.id}, current_date)`)) === 0,
      'holding_value_at, as the app, shows another household none of these holdings');
    ok(await scoped(hh.id, (tx) => n(tx`select count(*)::int as n from holding_value_at(${hh.id}, current_date)`)) === (await sql`select count(*)::int as n from holding where household_id = ${hh.id}`)[0].n,
      'and its own household all of them');
    await refusesWith('an override written into another household is refused', /row-level security/,
      () => scoped(elsewhere.id, (tx) => tx`insert into price_override ${sql({ household_id: hh.id, base: 'XTS', quote: 'INR',
        as_of: tomorrow, rate: '5' })}`));
    ok(await scoped(elsewhere.id, (tx) => n(tx`select count(*)::int as n from price_quote where base = 'XTS'`)) >= 2,
      'a quote is a market price: every household reads it');
    await refusesWith('the app cannot rewrite a quote\'s rate', /permission denied/,
      () => app`update price_quote set rate = 1 where base = 'XTS'`);
    await allows('the app may refresh a quote\'s fetched_at (and only that)',
      () => app`update price_quote set fetched_at = now() where base = 'XTS'`);
    await allows('the app may record a fetched quote',
      () => scoped(elsewhere.id, (tx) => tx`insert into price_quote ${sql({ base: 'XTS', quote: 'INR', as_of: yesterday,
        rate: '1', source: 'invariant-test' })}`));
    await refusesWith('but never rewrite one', /permission denied/,
      () => scoped(elsewhere.id, (tx) => tx`update price_quote set rate = 1000 where base = 'XTS'`));
    await refusesWith('or delete one', /permission denied/,
      () => scoped(elsewhere.id, (tx) => tx`delete from price_quote where base = 'XTS'`));
    await app.end();
  }
} catch (e) {
  ok(false, `the wealth section could not run: ${e.message.slice(0, 120)}`);
}
await sql`delete from price_quote where base = 'XTS'`.catch(() => {});

// ── the last way to pay is a preference, not a reference ──────────────────
/* Add Entry opens on the way this person last paid with. It is stored as the text reference the form sends, and
   must never be a foreign key: the rail can be archived, or belong to the other books this person keeps, and a
   stale preference must not be able to stop an entry (or an archive) from happening. */
{
  const [col] = await sql`select data_type, is_nullable from information_schema.columns
    where table_name = 'app_user' and column_name = 'last_paid_with'`;
  ok(col?.data_type === 'text' && col?.is_nullable === 'YES', 'app_user.last_paid_with is nullable text');
  const [{ n: fks }] = await sql`
    select count(*)::int as n from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'app_user'::regclass and c.contype = 'f' and a.attname = 'last_paid_with'`;
  ok(fks === 0, 'and no foreign key: a stale reference cannot hold a rail or an account in place');
  await allows('a reference that names nothing is stored as it is (resolved on read, never trusted)',
    () => sql`update app_user set last_paid_with = 'm:00000000-0000-4000-8000-000000000000' where id = ${user.id}`);
}

// ── SMS capture — a forwarded bank message is a draft, never an entry ──────
/* capture_token stores only the SHA-256 of a 256-bit token. sms_draft is one row per distinct
   message per household; it is never an entry on its own, and a draft cannot be marked accepted
   without the entry it became. */
console.log('\nSMS CAPTURE — drafts and tokens');
try {
  const HEX = (c) => c.repeat(64);
  const [h2] = await sql`insert into household ${sql({ name: 'Invariant test' })} returning id`;
  const [a1] = await sql`insert into account ${sql({ household_id: hh.id, name: 'Sms acct', kind: 'cash' })} returning id`;
  const [a2] = await sql`insert into account ${sql({ household_id: h2.id, name: 'Sms acct 2', kind: 'cash' })} returning id`;
  const mkTxn = async (household_id, account_id) => (await sql`insert into txn ${sql({ household_id, created_by: user.id,
    occurred_on: '2026-09-01', amount: 1000, currency: 'INR', kind: 'expense', account_id })} returning id`)[0];
  const t1 = await mkTxn(hh.id, a1.id), t2 = await mkTxn(h2.id, a2.id);
  const draft = (o = {}) => sql`insert into sms_draft ${sql({ household_id: hh.id, user_id: user.id, sender: 'HDFCBK',
    body: 'Rs 250 debited', body_hash: HEX('a'), ...o })} returning id`;
  const token = (o = {}) => sql`insert into capture_token ${sql({ user_id: user.id, household_id: hh.id,
    token_hash: HEX('b'), label: 'My phone', ...o })} returning id`;

  await allows('a draft with only what was found is stored', () => draft());
  await refusesWith('the same message twice in one household is one draft', /sms_draft_household_body/,
    () => draft());
  await allows('the same message in another household is a separate draft', () => draft({ household_id: h2.id, user_id: null }));
  await refusesWith('a draft marked accepted with no entry is refused', /sms_draft_accepted_has_txn/,
    () => draft({ body_hash: HEX('c'), status: 'accepted' }));
  await allows('accepted with its entry is allowed', () => draft({ body_hash: HEX('c'), status: 'accepted', txn_id: t1.id }));
  await refusesWith('an entry of another household cannot be a draft\'s entry', /sms_draft_txn_same_household|foreign key/,
    () => draft({ body_hash: HEX('d'), txn_id: t2.id }));
  await refusesWith('a body hash that is not 64 hex is refused', /sms_draft_body_hash_hex/, () => draft({ body_hash: 'abc' }));
  await refusesWith('an upper-case body hash is refused', /sms_draft_body_hash_hex/, () => draft({ body_hash: HEX('A') }));
  await refusesWith('a body over 2000 characters is refused', /sms_draft_body_len/, () => draft({ body_hash: HEX('e'), body: 'x'.repeat(2001) }));
  await refusesWith('a sender over 64 characters is refused', /sms_draft_sender_len/, () => draft({ body_hash: HEX('f'), sender: 'x'.repeat(65) }));
  await allows('a purged body (NULL) is allowed', () => draft({ body_hash: HEX('1'), body: null, sender: null }));
  /* ON DELETE SET NULL on txn_id is overtaken by the accepted check for an accepted draft: the entry it
     became cannot be hard-deleted from under it (the app soft-deletes entries). A draft that merely names an
     entry loses the link. */
  await refusesWith('an entry an accepted draft became cannot be hard-deleted from under it', /sms_draft_accepted_has_txn/,
    () => sql`delete from txn where id = ${t1.id}`);
  const [t3] = [await mkTxn(hh.id, a1.id)];
  await draft({ body_hash: HEX('3'), txn_id: t3.id });
  await sql`delete from txn where id = ${t3.id}`;
  const [{ txn_id: cleared, household_id: still }] = await sql`select txn_id, household_id from sms_draft where body_hash = ${HEX('3')} and household_id = ${hh.id}`;
  ok(cleared === null && still === hh.id, 'deleting an entry a non-accepted draft names clears only the link, not the household');

  await allows('a token is stored by its hash', () => token());
  await refusesWith('two tokens cannot share a hash', /capture_token_token_hash_unique/, () => token());
  await refusesWith('a token hash that is not 64 hex is refused', /capture_token_hash_hex/, () => token({ token_hash: 'plaintext-token' }));
  await refusesWith('an empty label is refused', /capture_token_label_len/, () => token({ token_hash: HEX('2'), label: '' }));
  await refusesWith('a label over 40 characters is refused', /capture_token_label_len/, () => token({ token_hash: HEX('2'), label: 'x'.repeat(41) }));
  const [{ n: tokCols }] = await sql`select count(*)::int as n from information_schema.columns
    where table_name = 'capture_token' and column_name in ('token', 'secret', 'plaintext')`;
  ok(tokCols === 0, 'capture_token has no column that could hold a usable token');

  if (appUser === 'saree_app') {
    const app = postgres(appUrl, { ssl: 'require', max: 1, onnotice: () => {} });
    const scoped = (id, fn) => app.begin(async (tx) => { await tx`select set_config('app.household_id', ${id}, true)`; return fn(tx); });
    const n = (q) => q.then((r) => r[0].n);
    ok(await n(app`select count(*)::int as n from capture_token`) === 0,
      'with no household named, no token can be listed');
    await refuses('nor inserted', () => app`insert into capture_token ${sql({ user_id: user.id, household_id: hh.id, token_hash: HEX('7'), label: 'x' })}`);
    ok((await app`update capture_token set revoked_at = null where token_hash = ${HEX('b')} returning id`).length === 0,
      'nor updated (a revoked token cannot be revived)');
    ok((await app`delete from capture_token where token_hash = ${HEX('b')} returning id`).length === 0, 'nor deleted');
    const live = await app`select * from capture_lookup(${HEX('b')})`;
    ok(live.length === 1 && live[0].household_id === hh.id && live[0].user_id === user.id && Object.keys(live[0]).sort().join() === 'household_id,id,user_id',
      'capture_lookup(hash) returns the one row (id, user, household) for a live token');
    ok((await app`select * from capture_lookup(${HEX('9')})`).length === 0, 'and none for an unknown hash');
    await sql`update capture_token set revoked_at = now() where token_hash = ${HEX('b')}`;
    ok((await app`select * from capture_lookup(${HEX('b')})`).length === 0, 'and none for a revoked token');
    await sql`update capture_token set revoked_at = null where token_hash = ${HEX('b')}`;
    ok((await app`select count(*)::int as n from pg_proc p join pg_roles r on r.oid = p.proowner
      where p.proname = 'capture_lookup' and p.prosecdef and r.rolname <> current_user`)[0].n === 1,
      'capture_lookup is a security-definer function owned by the owner, not the app role');
    ok(await n(app`select count(*)::int as n from sms_draft`) === 0, 'with no household named, no draft can be read');
    ok(await scoped(hh.id, (tx) => n(tx`select count(*)::int as n from sms_draft where household_id = ${hh.id}`)) === 4,
      'named, the household sees its own drafts');
    ok(await scoped(h2.id, (tx) => n(tx`select count(*)::int as n from sms_draft where household_id = ${hh.id}`)) === 0,
      'another household cannot read the drafts, asked for by household');
    ok(await scoped(h2.id, (tx) => n(tx`select count(*)::int as n from sms_draft where body_hash = ${HEX('c')}`)) === 0,
      'nor by body hash');
    ok(await scoped(h2.id, (tx) => n(tx`select count(*)::int as n from capture_token`)) === 0,
      'another household cannot read the tokens once one is named');
    ok(await scoped(hh.id, (tx) => n(tx`select count(*)::int as n from capture_token`)) === 1,
      'named, the household sees its own token');
    await refuses('scoped to another household, a draft cannot be written into this one',
      () => scoped(h2.id, (tx) => tx`insert into sms_draft ${sql({ household_id: hh.id, body_hash: HEX('9') })}`));
    await refuses('nor a token',
      () => scoped(h2.id, (tx) => tx`insert into capture_token ${sql({ user_id: user.id, household_id: hh.id, token_hash: HEX('8'), label: 'x' })}`));
    await app.end();
  }
  await sql`delete from household where id = ${h2.id}`;
} catch (e) {
  ok(false, `the SMS capture section could not run: ${e.message.slice(0, 120)}`);
}

await sql`delete from household where name = 'Invariant test'`;
await sql`delete from password_reset where user_id in
  (select id from app_user where phone = any(${PHONES}) or email = any(${EMAILS}))`;
await sql`delete from app_user where phone in ${sql(PHONES)}`;
await sql`delete from app_user where email in ${sql(EMAILS)}`;

console.log(`\n  ${pass} passed, ${fail} failed\n`);
await sql.end();
process.exit(fail ? 1 : 0);
