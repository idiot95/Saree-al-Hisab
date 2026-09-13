ALTER TABLE "claim" ALTER COLUMN "counterparty_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_one_held_by_tab_per_entry" ON "claim" USING btree ("txn_id") WHERE "claim"."counterparty_id" is null;--> statement-breakpoint
/* Hand-added, runs once: costs already on a tab that raised no claim — the
   tabs opened with nobody on them — become the tab's own claim for the whole
   amount, so what was already put on them reaches Owed to you. Only expenses
   that carry no claim at all; anything with a person's share is left alone. */
INSERT INTO "claim" ("household_id", "counterparty_id", "txn_id", "kind", "expected_amount")
SELECT t.household_id, NULL, t.id, 'reimbursement', t.amount
FROM "txn" t
WHERE t.book_id IS NOT NULL AND t.kind = 'expense' AND t.deleted_at IS NULL AND t.amount > 0
  AND NOT EXISTS (SELECT 1 FROM "claim" c WHERE c.txn_id = t.id);
