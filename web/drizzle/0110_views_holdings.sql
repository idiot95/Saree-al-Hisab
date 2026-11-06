/* Wealth: who owns what, and what a holding is worth today.

   Holdings (0035) are snapshots, never entries, so nothing here touches txn
   and no view the budget or a balance reads mentions them — an invariant
   proves it. This file re-applies every run, so everything is idempotent.

   It sorts AFTER 0109, whose loop sets security_invoker on every view that
   exists when it runs. The view below therefore sets it itself; dropping
   that option would let a view owned by the bypassing owner read past
   every row policy, and invariants.test.mjs fails the run if it is missing.

   No floats. A rate is numeric(24,10), a quantity a bigint, and the value
   is worked in numeric by MULTIPLICATION only — numeric multiplication is
   exact, where a division is rounded to a chosen scale and could turn a
   value just past a half into an exact half. Powers of ten with an integer
   exponent are exact too. The one rounding is the last step, half-even. */

/* How many minor-unit digits a currency has. MUST match CURRENCIES in
   src/lib/money.ts (the lib tests compare the two lists): three for the
   dinars and the Omani rial, none for the yen, won, dong and Ugandan
   shilling, two for everything else. */
CREATE OR REPLACE FUNCTION currency_digits(code text) RETURNS int
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN code IN ('BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND') THEN 3
    WHEN code IN ('JPY', 'KRW', 'UGX', 'VND') THEN 0
    ELSE 2
  END $$;

/* Banker's rounding to a whole number of minor units: an exact half goes to
   the even neighbour (0.5 → 0, 1.5 → 2, 2.5 → 2, -0.5 → 0, -1.5 → -2), so
   rounding many values does not drift upward. Postgres' own round(numeric)
   sends a half away from zero, which is right for everything that is not a
   tie. */
CREATE OR REPLACE FUNCTION round_half_even(x numeric) RETURNS bigint
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT (CASE WHEN abs(x - trunc(x)) = 0.5 AND mod(trunc(x), 2) = 0 THEN trunc(x)
               ELSE round(x) END)::bigint $$;

/* An owner is a member of the household the account or holding is in. NULL
   is joint and always allowed. Runs as the caller, so inside a scope it can
   only see this household's members — which is the question being asked. */
CREATE OR REPLACE FUNCTION owner_is_member_check() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM member m
       WHERE m.household_id = NEW.household_id AND m.user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'The owner must be a member of this household'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS account_owner_is_member ON account;
CREATE TRIGGER account_owner_is_member
  BEFORE INSERT OR UPDATE OF owner_user_id, household_id ON account
  FOR EACH ROW EXECUTE FUNCTION owner_is_member_check();

DROP TRIGGER IF EXISTS holding_owner_is_member ON holding;
CREATE TRIGGER holding_owner_is_member
  BEFORE INSERT OR UPDATE OF owner_user_id, household_id ON holding
  FOR EACH ROW EXECUTE FUNCTION owner_is_member_check();

/* Money in the household's own currency belongs in an account, where every
   entry can reach it. A pot is for a currency the books are NOT kept in. */
CREATE OR REPLACE FUNCTION fx_pot_not_base_check() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'fx_cash' AND NEW.currency = (
       SELECT h.base_currency FROM household h WHERE h.id = NEW.household_id) THEN
    RAISE EXCEPTION 'Use an account for %', NEW.currency
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fx_pot_not_base ON holding;
CREATE TRIGGER fx_pot_not_base
  BEFORE INSERT OR UPDATE OF kind, currency, household_id ON holding
  FOR EACH ROW EXECUTE FUNCTION fx_pot_not_base_check();

/* The same rule from the other side: books with no entries can still change
   currency (0107), and moving them into the currency of a pot they hold
   would make that pot base money. */
CREATE OR REPLACE FUNCTION household_base_not_a_pot_check() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency AND EXISTS (
       SELECT 1 FROM holding p
       WHERE p.household_id = NEW.id AND p.kind = 'fx_cash' AND p.currency = NEW.base_currency) THEN
    RAISE EXCEPTION 'Use an account for %: a pot already holds it', NEW.base_currency
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS household_base_not_a_pot ON household;
CREATE TRIGGER household_base_not_a_pot
  BEFORE UPDATE OF base_currency ON household
  FOR EACH ROW EXECUTE FUNCTION household_base_not_a_pot_check();

/* Each holding with its latest snapshot, the rate that applies today, and
   its value in the household's minor units.

   Which rate: the household's override with the latest as_of ≤ today,
   and the fetched quote with the latest as_of ≤ today (newest fetch, then
   source name, breaking a same-day tie between sources). The newer of the
   two wins; on the same day the override wins, because a person set it
   knowing the market. Nothing dated after today is used.

   The price is per unit of `base` — one whole unit of the pot's currency,
   or one gram of PURE metal — in whole units of the household's currency.
     fx_cash: quantity (minor units of the pot) × rate × 10^(digits(base) − digits(pot))
     metal:   quantity (mg) × purity‰ × rate × 10^(digits(base) − 6)
   value_minor is NULL — never zero — when there is no snapshot or no rate:
   "we do not know" must not read as "worth nothing".

   archived_at is carried, as account_balance carries it, so a caller can
   leave an archived holding out of today's figure without losing it. */
DROP VIEW IF EXISTS holding_value CASCADE;
CREATE VIEW holding_value WITH (security_invoker = true) AS
SELECT h.id,
       h.household_id,
       h.owner_user_id,
       h.kind,
       h.name,
       h.currency,
       h.metal,
       h.purity_permille,
       s.quantity,
       s.as_of,
       r.rate,
       r.as_of  AS rate_as_of,
       r.source AS rate_source,
       CASE h.kind
         WHEN 'fx_cash' THEN round_half_even(s.quantity::numeric * r.rate
           * power(10::numeric, (currency_digits(hh.base_currency) - currency_digits(h.currency))::numeric))
         WHEN 'metal' THEN round_half_even(s.quantity::numeric * h.purity_permille * r.rate
           * power(10::numeric, (currency_digits(hh.base_currency) - 6)::numeric))
       END AS value_minor,
       h.archived_at
FROM holding h
JOIN household hh ON hh.id = h.household_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN h.kind = 'fx_cash' THEN h.currency
    WHEN h.metal = 'gold'   THEN 'XAU'
    WHEN h.metal = 'silver' THEN 'XAG'
  END AS code
) b
LEFT JOIN LATERAL (
  SELECT sn.quantity, sn.as_of
  FROM holding_snapshot sn
  WHERE sn.holding_id = h.id
  ORDER BY sn.as_of DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT c.rate, c.as_of, c.source
  FROM (
    (SELECT o.rate, o.as_of, 'override'::text AS source, 0 AS pref
     FROM price_override o
     WHERE o.household_id = h.household_id AND o.base = b.code
       AND o.quote = hh.base_currency AND o.as_of <= current_date
     ORDER BY o.as_of DESC
     LIMIT 1)
    UNION ALL
    (SELECT q.rate, q.as_of, q.source, 1 AS pref
     FROM price_quote q
     WHERE q.base = b.code AND q.quote = hh.base_currency AND q.as_of <= current_date
     ORDER BY q.as_of DESC, q.fetched_at DESC, q.source
     LIMIT 1)
  ) c
  ORDER BY c.as_of DESC, c.pref
  LIMIT 1
) r ON true;
