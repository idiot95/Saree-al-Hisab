-- What each account actually holds, from the opening balance and every entry
-- that has touched it since. Nothing here is stored: a balance that is written
-- down is a balance that can disagree with the entries underneath it, and the
-- audit of v1 found exactly that.
--
-- Sign convention, and it matters: a credit account goes NEGATIVE as you spend
-- on it, because that is what owing money is. Paying the bill moves cash from
-- the bank into the card and walks it back towards zero. The UI turns that
-- into "you owe ₹X"; the arithmetic stays honest.

DROP VIEW IF EXISTS account_balance CASCADE;
CREATE VIEW account_balance AS
SELECT a.id,
       a.household_id,
       a.name,
       a.kind,
       a.currency,
       a.last4,
       a.credit_limit,
       a.statement_day,
       a.due_day,
       a.archived_at,
       a.opening_balance,
       a.opening_balance + COALESCE(SUM(
         CASE
           -- money leaving this account
           WHEN t.account_id = a.id
                AND t.kind IN ('expense', 'transfer', 'card_payment') THEN -t.amount
           -- money arriving in this account
           WHEN t.account_id = a.id
                AND t.kind IN ('income', 'claim_receipt', 'refund')   THEN  t.amount
           -- the far side of a move: a transfer or a bill payment landing here
           WHEN t.counter_account_id = a.id                            THEN  t.amount
           ELSE 0
         END), 0) AS balance,
       COUNT(t.id) AS entries
FROM account a
LEFT JOIN txn t
  ON (t.account_id = a.id OR t.counter_account_id = a.id)
 AND t.deleted_at IS NULL
GROUP BY a.id;

-- The one number a card screen is actually asked for: what is riding on the
-- cycle that has not closed yet.
DROP VIEW IF EXISTS card_open_cycle CASCADE;
CREATE VIEW card_open_cycle AS
SELECT DISTINCT ON (account_id)
       account_id, cycle_id, period_start, period_end, statement_on, due_on,
       status, charged, entries
FROM card_cycle_total
WHERE status <> 'paid'
ORDER BY account_id, period_start DESC;
