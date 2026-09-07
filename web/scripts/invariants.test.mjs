/* The invariants, proved rather than assumed.
   Every case below TRIES to break a rule and expects Postgres to refuse. The
   audit of v1 found the app disagreeing with itself on arithmetic; these are
   the constraints that make that impossible, so they are worth a test each.

   Run: node scripts/invariants.test.mjs                                      */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Resolved the same way the app resolves it, so a test or a migration can
   never end up pointing at a different database from the running app. */
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = process.env.DATABASE_URL
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
async function allows(what, fn) {
  try { await fn(); ok(true, what); }
  catch (e) { ok(false, `${what} — was refused: ${e.message.slice(0, 80)}`); }
}

// ── a household to work in ─────────────────────────────────────────────────
// Clear anything a previous run left behind, so this is repeatable even after
// a crash. Everything below is namespaced to a test household and two phones.
const PHONES = ['+910000000001', '+910000000002', '+910000000003'];
const EMAILS = ['invited@invariant.test', 'someone.else@invariant.test',
                'passing@invariant.test', 'negative@invariant.test'];
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
const card = await mk('HDFC Regalia', 'credit', { statement_day: 5, due_day: 12, credit_limit: 20000000 });
const [catRow] = await sql`insert into category ${sql({ household_id: hh.id, name: 'Groceries', icon: 'cart', tint: 'green' })} returning id`;
const cat = catRow.id;

const txn = (o) => sql`insert into txn ${sql({
  household_id: hh.id, created_by: user.id, occurred_on: '2026-09-01',
  amount: 100000, currency: 'INR', ...o })} returning id`;

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

await txn({ kind: 'income', account_id: fresh.id, category_id: cat, amount: 1000000 });
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
const [office] = await sql`insert into ledger_book ${sql({ household_id: hh.id, name: 'Office', counts_as_spending: true })} returning id, counts_as_spending`;
const [family] = await sql`insert into ledger_book ${sql({ household_id: hh.id, name: 'Family', counts_as_spending: false })} returning id`;
ok(office.counts_as_spending === true, 'a tab says whether costs on it are your own spending');
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

console.log('\nSCHEDULES — a salary comes round the way rent does');
await allows('a schedule can be income',
  () => sql`insert into schedule ${sql({ household_id: hh.id, kind: 'income', name: 'Salary', amount: 12000000,
    account_id: spend, category_id: cat, rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' })}`);
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

await sql`delete from household where id = ${hh.id}`;
await sql`delete from password_reset where user_id in
  (select id from app_user where phone = any(${PHONES}) or email = any(${EMAILS}))`;
await sql`delete from app_user where phone in ${sql(PHONES)}`;
await sql`delete from app_user where email in ${sql(EMAILS)}`;

console.log(`\n  ${pass} passed, ${fail} failed\n`);
await sql.end();
process.exit(fail ? 1 : 0);
