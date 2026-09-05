-- Which cycle a purchase falls into, from the card's statement day.
-- A statement on the 5th means the cycle running 6 Aug – 5 Sep.
CREATE OR REPLACE FUNCTION cycle_bounds(statement_day int, on_date date)
RETURNS TABLE (period_start date, period_end date) AS $$
  SELECT
    CASE WHEN date_part('day', on_date) > statement_day
         THEN date_trunc('month', on_date)::date + (statement_day)
         ELSE (date_trunc('month', on_date) - interval '1 month')::date + (statement_day)
    END,
    CASE WHEN date_part('day', on_date) > statement_day
         THEN (date_trunc('month', on_date) + interval '1 month')::date + (statement_day - 1)
         ELSE date_trunc('month', on_date)::date + (statement_day - 1)
    END;
$$ LANGUAGE sql IMMUTABLE;

-- What is actually on each cycle, and whether the bill has cleared it.
-- The purchases are expenses and were counted on the day they happened.
-- The payment is a card_payment, which invariant 1 keeps out of spending —
-- so a cycle can be settled without anything being counted twice.
DROP VIEW IF EXISTS card_cycle_total CASCADE;
CREATE VIEW card_cycle_total AS
SELECT c.id AS cycle_id, c.account_id, c.period_start, c.period_end,
       c.statement_on, c.due_on, c.status,
       COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'expense'), 0)
     - COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'refund'), 0) AS charged,
       COUNT(t.id) FILTER (WHERE t.kind IN ('expense','refund')) AS entries,
       p.amount AS paid_amount, p.occurred_on AS paid_on
FROM card_cycle c
LEFT JOIN txn t
  ON t.card_cycle_id = c.id AND t.deleted_at IS NULL
LEFT JOIN txn p
  ON p.id = c.paid_txn_id AND p.deleted_at IS NULL
GROUP BY c.id, c.account_id, c.period_start, c.period_end,
         c.statement_on, c.due_on, c.status, p.amount, p.occurred_on;

-- Where the money actually sits. A payment method is a rail, not a balance:
-- spending "by GPay" leaves the bank account GPay draws from, so a method
-- never holds money and never appears as one.
DROP VIEW IF EXISTS method_flow CASCADE;
CREATE VIEW method_flow AS
SELECT m.id AS method_id, m.household_id, m.name, m.kind,
       m.funding_account_id, a.name AS funding_account,
       COALESCE(SUM(t.amount), 0) AS spent,
       COUNT(t.id) AS entries
FROM payment_method m
JOIN account a ON a.id = m.funding_account_id
LEFT JOIN txn t
  ON t.payment_method_id = m.id
 AND t.kind = 'expense'
 AND t.deleted_at IS NULL
GROUP BY m.id, m.household_id, m.name, m.kind, m.funding_account_id, a.name;

-- A method must fund from an account that can actually pay: never a person,
-- and a card rail must draw on the credit account it belongs to. This needs a
-- trigger rather than a CHECK, because the rule depends on another table.
CREATE OR REPLACE FUNCTION method_funding_is_valid() RETURNS trigger AS $$
DECLARE k account_kind;
BEGIN
  SELECT kind INTO k FROM account WHERE id = NEW.funding_account_id;
  IF k = 'person' THEN
    RAISE EXCEPTION 'a payment method cannot draw on a person';
  END IF;
  IF NEW.kind = 'card' AND k <> 'credit' THEN
    RAISE EXCEPTION 'a card method must draw on a credit account';
  END IF;
  IF NEW.kind = 'upi' AND k NOT IN ('spending','cash') THEN
    RAISE EXCEPTION 'UPI draws on a spending or cash account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS method_funding_check ON payment_method;
CREATE TRIGGER method_funding_check
  BEFORE INSERT OR UPDATE ON payment_method
  FOR EACH ROW EXECUTE FUNCTION method_funding_is_valid();

-- On write, stamp the account from the method and file the purchase into the
-- right cycle. This is the auto-offset: nothing is remembered by hand.
CREATE OR REPLACE FUNCTION txn_apply_method() RETURNS trigger AS $$
DECLARE acct uuid; sday int; ps date; pe date; cyc uuid;
BEGIN
  /* The method decides the account. On insert that fills a blank; on update it
     OVERRIDES, because correcting "paid by GPay" to "paid by the card" has to
     move the money — otherwise the edit is cosmetic and the balances lie. */
  IF NEW.payment_method_id IS NOT NULL THEN
    SELECT funding_account_id INTO acct FROM payment_method WHERE id = NEW.payment_method_id;
    IF TG_OP = 'INSERT' THEN
      IF NEW.account_id IS NULL THEN NEW.account_id := acct; END IF;
    ELSIF NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id THEN
      NEW.account_id := acct;
    END IF;
  END IF;

  /* Re-filed from scratch every write, which is what clears it when an entry
     moves OFF a card. Leaving a stale cycle behind would keep a card bill
     charging for a purchase that is no longer on that card. */
  NEW.card_cycle_id := NULL;
  SELECT statement_day INTO sday FROM account WHERE id = NEW.account_id AND kind = 'credit';
  IF sday IS NOT NULL AND NEW.kind IN ('expense','refund') THEN
    SELECT period_start, period_end INTO ps, pe FROM cycle_bounds(sday, NEW.occurred_on);
    SELECT id INTO cyc FROM card_cycle WHERE account_id = NEW.account_id AND period_start = ps;
    IF cyc IS NULL THEN
      INSERT INTO card_cycle (account_id, period_start, period_end, statement_on, due_on)
      SELECT NEW.account_id, ps, pe, pe,
             pe + COALESCE((SELECT due_day - statement_day FROM account WHERE id = NEW.account_id), 7)
      RETURNING id INTO cyc;
    END IF;
    NEW.card_cycle_id := cyc;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS txn_method_cycle ON txn;
CREATE TRIGGER txn_method_cycle
  BEFORE INSERT OR UPDATE ON txn
  FOR EACH ROW EXECUTE FUNCTION txn_apply_method();
