-- The single definition of what counts as spending. Every budget figure,
-- category total, trend and donut reads from here — never from txn directly.
-- This is where invariants 1, 2 and 3 actually live.
DROP VIEW IF EXISTS spend_txn CASCADE;
CREATE VIEW spend_txn AS
SELECT t.*
FROM txn t
JOIN account a ON a.id = t.account_id
WHERE t.deleted_at IS NULL
  -- 1 & 2: a transfer or a card bill payment moves money, it does not spend it.
  AND t.kind = 'expense'
  -- 3: savings sits outside the budget, so moving money in never looks like
  --    an expense. A purchase ON a credit card IS spending, on the day it
  --    happened — only the bill payment is excluded, and that is kind above.
  AND a.kind <> 'savings';

-- Money in, which is not the same as income: a repayment lands in the account
-- but must never inflate the month's income.
DROP VIEW IF EXISTS income_txn CASCADE;
CREATE VIEW income_txn AS
SELECT t.* FROM txn t
WHERE t.deleted_at IS NULL AND t.kind = 'income';

-- What the savings figure is made of: money moved into a savings account.
DROP VIEW IF EXISTS savings_flow CASCADE;
CREATE VIEW savings_flow AS
SELECT t.*, a.id AS savings_account_id
FROM txn t
JOIN account a ON a.id = t.counter_account_id
WHERE t.deleted_at IS NULL AND t.kind = 'transfer' AND a.kind = 'savings';

-- INVARIANT 4 — duplicates are same account, same amount, within three days.
-- Detected, never prevented: two identical coffees in one day is legitimate,
-- so this surfaces a decision in the Inbox instead of rejecting the write.
DROP VIEW IF EXISTS duplicate_candidate CASCADE;
CREATE VIEW duplicate_candidate AS
SELECT a.id AS txn_id, b.id AS other_id, a.household_id, a.amount,
       a.account_id, a.occurred_on, b.occurred_on AS other_occurred_on
FROM txn a
JOIN txn b
  ON b.account_id = a.account_id
 AND b.amount = a.amount
 AND b.id > a.id
 AND b.occurred_on BETWEEN a.occurred_on - 3 AND a.occurred_on + 3
WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL;
