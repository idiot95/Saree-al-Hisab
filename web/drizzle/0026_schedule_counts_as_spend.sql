-- A standing expense answers the same question a one-off does: was this money
-- yours to spend, or laid out for somebody else? Rent fronted for a cousin
-- every month is never your spending; the office petrol you are reimbursed for
-- is. Copied onto every entry the schedule records, because spend_txn reads
-- the entry, not the rule.
ALTER TABLE "schedule" ADD COLUMN "counts_as_spend" boolean DEFAULT true NOT NULL;
