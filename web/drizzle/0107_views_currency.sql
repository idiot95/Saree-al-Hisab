-- The household's currency: chosen once, honoured by every entry.
--
-- Two rules, both about another table and so both triggers rather than
-- CHECKs. An entry that does not say its currency is in the household's own
-- (the column has no default, so the household's is what an omitted value
-- becomes); one that names some other currency has to say what it was worth
-- in the household's. And the household's own cannot change once there is an
-- entry recorded in it, because every amount in the books would silently
-- mean something else.

CREATE OR REPLACE FUNCTION txn_currency_shape() RETURNS trigger AS $$
DECLARE base text;
BEGIN
  SELECT base_currency INTO base FROM household WHERE id = NEW.household_id;
  IF NEW.currency IS NULL THEN
    NEW.currency := base;
  ELSIF NEW.currency <> base AND NEW.fx_rate IS NULL THEN
    RAISE EXCEPTION 'an entry in another currency needs a rate to %', base;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS txn_currency_check ON txn;
CREATE TRIGGER txn_currency_check
  BEFORE INSERT OR UPDATE OF currency, fx_rate, household_id ON txn
  FOR EACH ROW EXECUTE FUNCTION txn_currency_shape();

CREATE OR REPLACE FUNCTION household_currency_fixed() RETURNS trigger AS $$
BEGIN
  IF NEW.base_currency <> OLD.base_currency
     AND EXISTS (SELECT 1 FROM txn WHERE household_id = NEW.id) THEN
    RAISE EXCEPTION 'the currency cannot change once the books hold an entry';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS household_currency_check ON household;
CREATE TRIGGER household_currency_check
  BEFORE UPDATE OF base_currency ON household
  FOR EACH ROW EXECUTE FUNCTION household_currency_fixed();
