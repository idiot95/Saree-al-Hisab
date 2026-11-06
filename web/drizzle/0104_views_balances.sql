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
       a.bank_key,
       a.card_network,
       a.credit_limit,
       a.statement_day,
       a.due_day,
       a.archived_at,
       a.owner_user_id,   -- NULL is joint; whose it is, for per-person net worth
       a.opening_balance,
       a.opening_balance + COALESCE(SUM(
         CASE
           -- money leaving this account
           WHEN t.account_id = a.id
                AND t.kind IN ('expense', 'transfer', 'card_payment', 'adjust_out') THEN -t.amount
           -- money arriving in this account
           WHEN t.account_id = a.id
                AND t.kind IN ('income', 'claim_receipt', 'refund', 'adjust_in') THEN  t.amount
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

-- What is still owed on each bill. Nothing marks a cycle paid when the card is
-- paid — a card payment is a transfer into the card, never a status flag — so
-- "is this bill settled" is DERIVED from the card's balance, like everything
-- else here. Payments clear the oldest bills first, so whatever the card still
-- owes belongs to the newest cycles: each cycle's outstanding is its charges,
-- capped by the debt left after every newer cycle has taken its share. A card
-- that owes nothing (or is in credit) has no bill outstanding at all.
DROP VIEW IF EXISTS card_bill CASCADE;
CREATE VIEW card_bill AS
WITH debt AS (
  SELECT b.id AS account_id, GREATEST(0, -b.balance) AS owed
  FROM account_balance b
  WHERE b.kind = 'credit'
), cyc AS (
  SELECT c.cycle_id, c.account_id, c.period_start, c.period_end, c.statement_on,
         c.due_on, c.charged, c.entries, d.owed,
         COALESCE(SUM(c.charged) OVER (PARTITION BY c.account_id ORDER BY c.period_start DESC
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS newer
  FROM card_cycle_total c
  JOIN debt d ON d.account_id = c.account_id
  WHERE c.status <> 'paid' AND c.charged > 0
)
SELECT cycle_id, account_id, period_start, period_end, statement_on, due_on,
       charged, entries, LEAST(charged, GREATEST(0, owed - newer)) AS outstanding
FROM cyc;
