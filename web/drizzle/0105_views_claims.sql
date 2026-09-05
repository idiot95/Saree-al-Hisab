-- What a claim actually stands at. How much has come back is DERIVED from the
-- claim_receipt entries pointing at it, never stored: a counter is a number
-- that can disagree with the entries beneath it, and the audit of v1 found
-- exactly that kind of disagreement.
--
-- A reimbursement is NOT a loan and the arithmetic differs. Lending moves
-- money into someone's account and never counts as spending. A reimbursement
-- is spending that already happened and stays counted — what is outstanding is
-- a claim against a person, not a balance in an account. So this view sits
-- beside counterparty_balance rather than feeding into it.

DROP VIEW IF EXISTS claim_state CASCADE;
CREATE VIEW claim_state AS
SELECT c.id,
       c.household_id,
       c.counterparty_id,
       c.txn_id,
       c.kind,
       c.expected_amount,
       c.expected_by,
       c.note,
       c.written_off_at,
       c.created_at,
       COALESCE(r.received, 0)                        AS received,
       c.expected_amount - COALESCE(r.received, 0)    AS outstanding,
       CASE
         WHEN c.written_off_at IS NOT NULL                  THEN 'written_off'
         WHEN COALESCE(r.received, 0) >= c.expected_amount  THEN 'settled'
         WHEN COALESCE(r.received, 0) > 0                   THEN 'part_paid'
         ELSE 'open'
       END                                            AS status
FROM claim c
LEFT JOIN (
  SELECT claim_id, SUM(amount) AS received
  FROM txn
  WHERE kind = 'claim_receipt' AND deleted_at IS NULL
  GROUP BY claim_id
) r ON r.claim_id = c.id;

-- One line per person: what they owe you for things you paid for, separate
-- from anything you lent them.
DROP VIEW IF EXISTS counterparty_claims CASCADE;
CREATE VIEW counterparty_claims AS
SELECT cp.id                                    AS counterparty_id,
       cp.household_id,
       COALESCE(SUM(cs.outstanding) FILTER (
         WHERE cs.status IN ('open', 'part_paid')), 0) AS owed,
       COUNT(cs.id) FILTER (
         WHERE cs.status IN ('open', 'part_paid'))::int AS open_claims
FROM counterparty cp
LEFT JOIN claim_state cs ON cs.counterparty_id = cp.id
GROUP BY cp.id, cp.household_id;
