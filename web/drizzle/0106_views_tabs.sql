-- What a tab is owed. A cost put on a tab raises one claim per person on it
-- for their share, and a claim's outstanding amount is derived in claim_state
-- from the receipts pointing at it — so this view never stores a figure that
-- could disagree with the entries beneath it. Confined to entries filed under
-- the tab, which is what lets the tab answer "where do we stand on this"
-- without guessing which of a person's debts a payment was meant for.
DROP VIEW IF EXISTS tab_balance CASCADE;
CREATE VIEW tab_balance AS
SELECT t.book_id, cs.household_id, cs.counterparty_id,
       COALESCE(SUM(cs.expected_amount), 0) AS owed_in_all,
       COALESCE(SUM(cs.received), 0)        AS back,
       COALESCE(SUM(cs.outstanding), 0)     AS outstanding
FROM claim_state cs
JOIN txn t ON t.id = cs.txn_id AND t.deleted_at IS NULL
WHERE t.book_id IS NOT NULL AND cs.written_off_at IS NULL
GROUP BY t.book_id, cs.household_id, cs.counterparty_id;

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

/* A claim nobody is named on is the tab's own: a cost put on a tab with no
   contact is still money expected back, so it is a claim and counts in what
   is owed — but only an entry filed under a tab can carry one. A claim with
   no counterparty on an entry that is on no tab would be owed by no one,
   which is not a debt but a number. Held here because a CHECK cannot see
   the entry. (Deleting a tab un-files its entries through the foreign key;
   deleteTab writes the tab's own open claims off first, in the same
   transaction, so none is left owed by nothing.) */
CREATE OR REPLACE FUNCTION claim_holder_shape() RETURNS trigger AS $$
BEGIN
  IF NEW.counterparty_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM txn t WHERE t.id = NEW.txn_id AND t.book_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'a claim with nobody named must be on an entry filed under a tab';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS claim_holder_check ON claim;
CREATE TRIGGER claim_holder_check
  BEFORE INSERT OR UPDATE ON claim
  FOR EACH ROW EXECUTE FUNCTION claim_holder_shape();
