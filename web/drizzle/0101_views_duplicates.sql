-- A confirmed "these are both real" must stick, or the pair nags forever.
CREATE TABLE IF NOT EXISTS duplicate_dismissed (
  low_id  uuid NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
  high_id uuid NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
  dismissed_by uuid NOT NULL REFERENCES app_user(id),
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (low_id, high_id),
  CONSTRAINT ordered_pair CHECK (low_id < high_id)
);

DROP VIEW IF EXISTS duplicate_candidate;

-- Two different duplicates, two different rules.
CREATE VIEW duplicate_candidate AS
WITH pairs AS (
  -- RULE A — one person, two entries for one purchase. Typing it twice, or
  -- a receipt scan landing on top of something already keyed in. Tight match.
  SELECT a.id AS low_id, b.id AS high_id, a.household_id,
         'same_account'::text AS reason, 3 AS day_window
  FROM txn a
  JOIN txn b
    ON b.id > a.id
   AND b.household_id = a.household_id
   AND b.account_id = a.account_id
   AND b.amount = a.amount
   AND b.occurred_on BETWEEN a.occurred_on - 3 AND a.occurred_on + 3
  WHERE a.kind = 'expense' AND b.kind = 'expense'

  UNION

  -- RULE B — two people recording the same purchase. This one deliberately
  -- IGNORES the account, because that is precisely what they disagree about:
  -- he knows he paid by card, she assumes cash. It also tolerates a small
  -- amount difference, because one of them rounds or reads a different total.
  -- Requires some corroboration (same category or same merchant) so it does
  -- not flag two unrelated purchases that happen to cost the same.
  SELECT a.id, b.id, a.household_id, 'two_people'::text, 2
  FROM txn a
  JOIN txn b
    ON b.id > a.id
   AND b.household_id = a.household_id
   AND b.created_by <> a.created_by
   AND abs(b.amount - a.amount) <= greatest(100, a.amount / 100)   -- ±₹1 or ±1%
   AND b.occurred_on BETWEEN a.occurred_on - 2 AND a.occurred_on + 2
   AND (
        b.category_id IS NOT DISTINCT FROM a.category_id
     OR lower(btrim(coalesce(b.merchant,''))) = lower(btrim(coalesce(a.merchant,'')))
   )
  WHERE a.kind = 'expense' AND b.kind = 'expense'
)
SELECT p.low_id, p.high_id, p.household_id, p.reason,
       lo.amount AS low_amount, hi.amount AS high_amount,
       lo.occurred_on AS low_on, hi.occurred_on AS high_on,
       lo.created_by AS low_by, hi.created_by AS high_by,
       lo.merchant AS low_merchant, hi.merchant AS high_merchant
FROM pairs p
JOIN txn lo ON lo.id = p.low_id
JOIN txn hi ON hi.id = p.high_id
WHERE lo.deleted_at IS NULL
  AND hi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM duplicate_dismissed d
    WHERE d.low_id = p.low_id AND d.high_id = p.high_id
  );

-- Rule B searches by household + amount + date, so give it an index that fits.
CREATE INDEX IF NOT EXISTS txn_household_amount_date
  ON txn (household_id, amount, occurred_on) WHERE deleted_at IS NULL;
