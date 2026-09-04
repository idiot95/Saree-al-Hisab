import {
  pgTable, pgEnum, uuid, text, integer, bigint, date, timestamp,
  boolean, jsonb, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

/* ── money ───────────────────────────────────────────────────────────────
   Every amount is stored as an integer in the currency's minor unit (paise
   for INR, cents for USD). Floats are never allowed near a ledger.          */

export const accountKind = pgEnum('account_kind', ['spending', 'savings', 'credit', 'cash', 'person']);
/* The three ways money comes back are NOT the same thing, and the difference
   is whether it was ever your spending:
     lending      — never your spending. A transfer to that person's account.
     reimbursable — IS your spending now, recovered later. A normal expense
                    with an open claim; the recovery is a claim_receipt.
     refund       — undoes spending that already happened. Reduces the
                    category in the month the refund lands.                  */
export const txnKind = pgEnum('txn_kind', [
  'expense', 'income', 'transfer', 'card_payment', 'claim_receipt', 'refund',
]);
export const memberRole = pgEnum('member_role', ['owner', 'adult', 'viewer']);
export const txnSource = pgEnum('txn_source', ['manual', 'receipt', 'shared']);
export const claimKind = pgEnum('claim_kind', ['reimbursement', 'loan', 'shared', 'refund_due']);
export const claimStatus = pgEnum('claim_status', ['open', 'part_paid', 'settled', 'written_off']);
export const dueStatus = pgEnum('due_status', ['pending', 'paid', 'skipped']);
export const inboxKind = pgEnum('inbox_kind', ['expected_income', 'recurring', 'duplicate']);
export const inboxStatus = pgEnum('inbox_status', ['open', 'accepted', 'dismissed']);
export const methodKind = pgEnum('method_kind', ['upi', 'card', 'netbanking', 'cash', 'cheque', 'wallet', 'autodebit']);
export const bookKind = pgEnum('book_kind', ['loan', 'reimbursement']);
export const cycleStatus = pgEnum('cycle_status', ['open', 'statemented', 'paid']);

export const household = pgTable('household', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull().default('INR'),
  monthStartsOn: integer('month_starts_on').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('month_start_valid', sql`${t.monthStartsOn} between 1 and 28`),
]);

/* Identity comes from Google, so email is the key and phone is optional —
   it stays because a household still wants a number to remind someone on. */
export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  name: text('name').notNull(),
  image: text('image'),
  recoveryEmail: text('recovery_email'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // One of the two must identify them. Without this a nameless row with
  // neither could be created and never matched to anyone again.
  check('has_an_identity', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
]);

export const member = pgTable('member', {
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  role: memberRole('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('member_pk').on(t.householdId, t.userId),
]);

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: accountKind('kind').notNull(),
  currency: text('currency').notNull().default('INR'),
  openingBalance: bigint('opening_balance', { mode: 'number' }).notNull().default(0),
  last4: text('last4'),
  creditLimit: bigint('credit_limit', { mode: 'number' }),
  statementDay: integer('statement_day'),
  dueDay: integer('due_day'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  index('account_household').on(t.householdId),
  // INVARIANT 3, half of it: only a credit account may carry card metadata.
  check('card_fields_only_on_credit', sql`
    ${t.kind} = 'credit'
    OR (${t.creditLimit} IS NULL AND ${t.statementDay} IS NULL AND ${t.dueDay} IS NULL)`),
]);

export const relationship = pgEnum('relationship', ['family', 'friend', 'work', 'vendor']);

/* A person is modelled as an account of kind 'person', so lending is a
   transfer and every existing invariant applies unchanged. The UI never says
   "account" — it says Ahmed. */
export const counterparty = pgTable('counterparty', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  relationship: relationship('relationship').notNull().default('friend'),
  tint: text('tint').notNull().default('neutral'),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  index('counterparty_household').on(t.householdId),
  uniqueIndex('counterparty_account').on(t.accountId),
]);

/* A folder. Optional on an entry, and it may span several people — which a
   folder nested inside one person could not express. Grouping only: no
   splits, by decision. */
export const ledgerBook = pgTable('ledger_book', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  /* A loan book holds money you lent — never spending. A reimbursement book
     holds money you spent on someone else's behalf — spending you expect back.
     They settle differently, so the kind is not decoration. */
  kind: bookKind('kind').notNull().default('reimbursement'),
  name: text('name').notNull(),
  note: text('note'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (t) => [index('ledger_book_household').on(t.householdId)]);

export const bookMember = pgTable('book_member', {
  bookId: uuid('book_id').notNull().references(() => ledgerBook.id, { onDelete: 'cascade' }),
  counterpartyId: uuid('counterparty_id').notNull().references(() => counterparty.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('book_member_pk').on(t.bookId, t.counterpartyId)]);

/* GPay, PhonePe, a physical card, netbanking, cash in hand. A method is a
   RAIL, not a balance: paying by GPay moves money out of the bank account it
   draws from, so the method carries a funding account and the transaction
   still records that account. Without this, "where is my money" is wrong the
   moment UPI is involved — which in India is most of the time. */
export const paymentMethod = pgTable('payment_method', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: methodKind('kind').notNull(),
  fundingAccountId: uuid('funding_account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  handle: text('handle'),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  index('method_household').on(t.householdId),
  index('method_account').on(t.fundingAccountId),
]);

/* One billing period on a credit card. Purchases fall into a cycle by date;
   the bill payment settles the whole cycle. This is what makes "already
   counted" true and checkable rather than a claim in a caption. */
export const cardCycle = pgTable('card_cycle', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  statementOn: date('statement_on').notNull(),
  dueOn: date('due_on').notNull(),
  statementAmount: bigint('statement_amount', { mode: 'number' }),
  status: cycleStatus('status').notNull().default('open'),
  paidTxnId: uuid('paid_txn_id'),
}, (t) => [
  uniqueIndex('cycle_unique').on(t.accountId, t.periodStart),
  index('cycle_due').on(t.status, t.dueOn),
  check('period_ordered', sql`${t.periodEnd} > ${t.periodStart}`),
  check('due_after_statement', sql`${t.dueOn} >= ${t.statementOn}`),
  check('paid_has_a_payment', sql`${t.status} <> 'paid' OR ${t.paidTxnId} IS NOT NULL`),
]);

export const category = pgTable('category', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  tint: text('tint').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [uniqueIndex('category_unique').on(t.householdId, t.name)]);

/* Monthly, carried forward: one row per category per month. September is
   written as a copy of August when the month rolls over, so editing September
   can never rewrite what August actually was.                                */
export const budget = pgTable('budget', {
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  month: date('month').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
}, (t) => [
  uniqueIndex('budget_pk').on(t.categoryId, t.month),
  check('budget_non_negative', sql`${t.amount} >= 0`),
  check('budget_month_is_first', sql`date_part('day', ${t.month}) = 1`),
]);

export const txn = pgTable('txn', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  kind: txnKind('kind').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('INR'),
  fxRate: integer('fx_rate'),
  occurredOn: date('occurred_on').notNull(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  counterAccountId: uuid('counter_account_id').references(() => account.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => category.id, { onDelete: 'set null' }),
  merchant: text('merchant'),
  note: text('note'),
  isShared: boolean('is_shared').notNull().default(false),
  source: txnSource('source').notNull().default('manual'),
  createdBy: uuid('created_by').notNull().references(() => appUser.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  bookId: uuid('book_id'),
  reversesTxnId: uuid('reverses_txn_id'),
  /* How it was paid. The account stays authoritative for balances — the
     method only prefills it and answers "how much goes through UPI". */
  paymentMethodId: uuid('payment_method_id'),
  cardCycleId: uuid('card_cycle_id'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  index('txn_book').on(t.bookId),
  index('txn_cycle').on(t.cardCycleId),
  index('txn_ledger').on(t.householdId, t.occurredOn),
  index('txn_category_month').on(t.categoryId, t.occurredOn),
  // Makes the ±3-day duplicate sweep cheap. Detection, not prevention:
  // a real double-spend at the same shop is legitimate, so this surfaces
  // a decision in the Inbox rather than rejecting the write.
  index('txn_dupe_probe').on(t.accountId, t.amount, t.occurredOn),

  check('amount_positive', sql`${t.amount} > 0`),

  // INVARIANT 1 & 2, shape half: a transfer or a card payment moves money
  // between two accounts and can never wear a category — which is what stops
  // it ever being counted as spending anywhere downstream.
  check('moves_have_two_sides', sql`
    (${t.kind} IN ('transfer','card_payment'))
      = (${t.counterAccountId} IS NOT NULL)`),
  check('moves_carry_no_category', sql`
    ${t.kind} NOT IN ('transfer','card_payment','claim_receipt') OR ${t.categoryId} IS NULL`),
  check('no_self_transfer', sql`
    ${t.counterAccountId} IS NULL OR ${t.counterAccountId} <> ${t.accountId}`),
  check('fx_rate_with_foreign_currency', sql`
    ${t.currency} = 'INR' OR ${t.fxRate} IS NOT NULL`),
  // A refund undoes a specific purchase and carries that purchase's category,
  // so the reduction lands where the spending did.
  check('refund_points_at_a_purchase', sql`
    (${t.kind} = 'refund') = (${t.reversesTxnId} IS NOT NULL)`),
  check('refund_has_a_category', sql`
    ${t.kind} <> 'refund' OR ${t.categoryId} IS NOT NULL`),
]);

export const claim = pgTable('claim', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  person: text('person').notNull(),
  kind: claimKind('kind').notNull(),
  expectedAmount: bigint('expected_amount', { mode: 'number' }).notNull(),
  receivedAmount: bigint('received_amount', { mode: 'number' }).notNull().default(0),
  expectedBy: date('expected_by'),
  status: claimStatus('status').notNull().default('open'),
}, (t) => [
  check('received_not_over', sql`${t.receivedAmount} between 0 and ${t.expectedAmount}`),
]);

export const claimItem = pgTable('claim_item', {
  claimId: uuid('claim_id').notNull().references(() => claim.id, { onDelete: 'cascade' }),
  txnId: uuid('txn_id').notNull().references(() => txn.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('claim_item_pk').on(t.claimId, t.txnId)]);

export const schedule = pgTable('schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: bigint('amount', { mode: 'number' }),
  amountFromStatement: boolean('amount_from_statement').notNull().default(false),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => category.id, { onDelete: 'set null' }),
  rrule: text('rrule'),
  hijriRule: text('hijri_rule'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  // Either you know the amount or it comes off a statement — never neither.
  check('amount_known_or_from_statement', sql`
    (${t.amount} IS NOT NULL) <> ${t.amountFromStatement}`),
  check('has_a_rule', sql`${t.rrule} IS NOT NULL OR ${t.hijriRule} IS NOT NULL`),
]);

export const occurrence = pgTable('occurrence', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedule.id, { onDelete: 'cascade' }),
  dueOn: date('due_on').notNull(),
  status: dueStatus('status').notNull().default('pending'),
  txnId: uuid('txn_id').references(() => txn.id, { onDelete: 'set null' }),
}, (t) => [
  uniqueIndex('occurrence_unique').on(t.scheduleId, t.dueOn),
  index('occurrence_due').on(t.status, t.dueOn),
  check('paid_has_txn', sql`${t.status} <> 'paid' OR ${t.txnId} IS NOT NULL`),
]);

export const inboxItem = pgTable('inbox_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.id, { onDelete: 'cascade' }),
  kind: inboxKind('kind').notNull(),
  payload: jsonb('payload').notNull(),
  status: inboxStatus('status').notNull().default('open'),
  resolvedTxnId: uuid('resolved_txn_id').references(() => txn.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('inbox_open').on(t.householdId, t.status)]);

/* A pair the household has confirmed is genuinely two purchases. Without
   this, the same two rows re-surface in the Inbox every time it is rebuilt. */
export const duplicateDismissed = pgTable('duplicate_dismissed', {
  lowId: uuid('low_id').notNull().references(() => txn.id, { onDelete: 'cascade' }),
  highId: uuid('high_id').notNull().references(() => txn.id, { onDelete: 'cascade' }),
  dismissedBy: uuid('dismissed_by').notNull().references(() => appUser.id),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('duplicate_dismissed_pk').on(t.lowId, t.highId),
  check('ordered_pair', sql`${t.lowId} < ${t.highId}`),
]);

export const device = pgTable('device', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  pushEndpoint: text('push_endpoint'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdRelations = relations(household, ({ many }) => ({
  members: many(member), accounts: many(account), categories: many(category), txns: many(txn),
}));
export const txnRelations = relations(txn, ({ one }) => ({
  account: one(account, { fields: [txn.accountId], references: [account.id] }),
  counterAccount: one(account, { fields: [txn.counterAccountId], references: [account.id] }),
  category: one(category, { fields: [txn.categoryId], references: [category.id] }),
}));
