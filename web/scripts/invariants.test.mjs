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
const url = /^DATABASE_URL="?([^"\n]+)/m.exec(readFileSync(join(root, '.env.local'), 'utf8'))[1];
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
const PHONES = ['+910000000001', '+910000000002'];
const EMAILS = ['invited@invariant.test', 'someone.else@invariant.test'];
await sql`delete from household where name = 'Invariant test'`;
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

const spent = async () => Number((await sql`select coalesce(sum(amount),0)::bigint as t from spend_txn`)[0].t);
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
  token: 'tok-' + Math.random().toString(36).slice(2),
  expires_at: new Date(Date.now() + 7 * 864e5), ...o })} returning id, token`;

await refuses('an invite marked accepted with no time on it is refused',
  () => mkInvite({ status: 'accepted' }));
await refuses('an owner role handed out by invite is refused at the column',
  () => mkInvite({ role: 'nobody' }));
const [live] = await mkInvite();
await refuses('two invites cannot share a token',
  () => mkInvite({ token: live.token }));

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

const [joiner] = await sql`insert into app_user ${sql({ email: invited, name: 'Invited' })} returning id`;
await sql`insert into member ${sql({ household_id: hh.id, user_id: joiner.id, role: 'adult' })}`;
await sql`insert into txn ${sql({ household_id: hh.id, created_by: joiner.id, kind: 'expense',
  amount: 55500, occurred_on: '2026-09-03', account_id: cash, category_id: cat })}`;
const withThem = await spent();
await sql`delete from member where household_id = ${hh.id} and user_id = ${joiner.id}`;
ok(await spent() === withThem,
  'removing someone leaves what they recorded standing — the books are the household\'s');
await refuses('a member row pointing at no user is refused',
  () => sql`insert into member ${sql({ household_id: hh.id, user_id: hh.id, role: 'adult' })}`);

await sql`delete from household where id = ${hh.id}`;
await sql`delete from app_user where phone in ${sql(PHONES)}`;
await sql`delete from app_user where email in ${sql(EMAILS)}`;

console.log(`\n  ${pass} passed, ${fail} failed\n`);
await sql.end();
process.exit(fail ? 1 : 0);
