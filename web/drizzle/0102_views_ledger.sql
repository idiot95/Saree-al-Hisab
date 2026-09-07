-- DECISION 1 — spend now nets refunds off, in the month the refund lands.
-- Lending never appears here at all, because it is a transfer to a person's
-- account and invariant 2 already excludes transfers.
-- A reimbursable expense DOES appear: it was genuinely your spending, and
-- being paid back for it later does not unspend it.
-- DECISION 5 — what you laid out for someone else does NOT appear. That is the
-- one case where money leaves your account and was never yours to spend, and
-- counts_as_spend is how an entry says so. It is deliberately separate from
-- whether the money is owed back: petrol burnt for work is your spending AND
-- reimbursed; rent fronted for a cousin is neither.
-- Supersedes the spend_txn defined in 0100: fewer columns, and refunds
-- netted off. CREATE OR REPLACE cannot narrow a view, so it is dropped first.
DROP VIEW IF EXISTS spend_txn CASCADE;
CREATE VIEW spend_txn AS
SELECT t.id, t.household_id, t.category_id, t.account_id, t.occurred_on,
       t.book_id, t.merchant, t.is_shared, t.created_by,
       CASE WHEN t.kind = 'refund' THEN -t.amount ELSE t.amount END AS amount
FROM txn t
JOIN account a ON a.id = t.account_id
WHERE t.deleted_at IS NULL
  AND t.kind IN ('expense', 'refund')
  AND t.counts_as_spend
  AND a.kind <> 'savings';
/* Person accounts are deliberately NOT excluded here, and the reason is worth
   stating. Lending is a TRANSFER and transfers are excluded by kind, so money
   lent still never counts as spending. The only thing that can put an expense
   on a person's account is writing off what they owe — and that is exactly
   when the money stops being a loan and becomes money you spent. Excluding
   person accounts wholesale would have made forgiving a debt invisible. */

-- Accounts the user actually holds. People are accounts underneath, but they
-- must never appear in balances, pickers or the "feeds the budget" totals.
DROP VIEW IF EXISTS real_account CASCADE;
CREATE VIEW real_account AS
SELECT * FROM account WHERE kind <> 'person';

-- One running balance per person. This is the khata.
DROP VIEW IF EXISTS counterparty_balance CASCADE;
CREATE VIEW counterparty_balance AS
SELECT c.id AS counterparty_id, c.household_id, c.name, c.relationship,
       COALESCE(SUM(
         CASE WHEN t.counter_account_id = c.account_id THEN  t.amount
              WHEN t.account_id        = c.account_id THEN -t.amount
              ELSE 0 END), 0) AS balance
FROM counterparty c
LEFT JOIN txn t
  ON (t.counter_account_id = c.account_id OR t.account_id = c.account_id)
 AND t.deleted_at IS NULL
GROUP BY c.id, c.household_id, c.name, c.relationship;
