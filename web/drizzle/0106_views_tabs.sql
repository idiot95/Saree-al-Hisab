-- A tab is a lending group: costs put on it are owed back in full, divided
-- among the people on it. What is outstanding on a tab is therefore the same
-- arithmetic as the khata — money out to a person, less money back from them —
-- but confined to the entries filed under that tab.
DROP VIEW IF EXISTS tab_balance CASCADE;
CREATE VIEW tab_balance AS
SELECT t.book_id, t.household_id, cp.id AS counterparty_id,
       COALESCE(SUM(CASE WHEN t.counter_account_id = cp.account_id THEN t.amount
                         ELSE 0 END), 0) AS lent,
       COALESCE(SUM(CASE WHEN t.account_id = cp.account_id THEN t.amount
                         ELSE 0 END), 0) AS back,
       COALESCE(SUM(CASE WHEN t.counter_account_id = cp.account_id THEN  t.amount
                         WHEN t.account_id         = cp.account_id THEN -t.amount
                         ELSE 0 END), 0) AS outstanding
FROM txn t
JOIN counterparty cp
  ON cp.household_id = t.household_id
 AND (cp.account_id = t.counter_account_id OR cp.account_id = t.account_id)
WHERE t.book_id IS NOT NULL AND t.deleted_at IS NULL
GROUP BY t.book_id, t.household_id, cp.id;

/* A transfer may carry a category, but only one that means something: money
   laid out for a person. "₹3,000 of petrol, on the office tab" is a fact worth
   keeping; a category on a sweep between two of your own accounts is noise
   that would show up in the ledger looking like spending it is not. Held here
   rather than in a CHECK because a CHECK cannot see another table. */
CREATE OR REPLACE FUNCTION txn_category_shape() RETURNS trigger AS $$
DECLARE k account_kind;
BEGIN
  IF NEW.kind = 'transfer' AND NEW.category_id IS NOT NULL THEN
    SELECT kind INTO k FROM account WHERE id = NEW.counter_account_id;
    IF k IS DISTINCT FROM 'person' THEN
      RAISE EXCEPTION 'only money laid out for a person can carry a category';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS txn_category_check ON txn;
CREATE TRIGGER txn_category_check
  BEFORE INSERT OR UPDATE ON txn
  FOR EACH ROW EXECUTE FUNCTION txn_category_shape();
