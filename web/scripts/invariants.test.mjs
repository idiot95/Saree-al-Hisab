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
