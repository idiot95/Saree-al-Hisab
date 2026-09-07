DROP INDEX "txn_group";--> statement-breakpoint
ALTER TABLE "ledger_book" ADD COLUMN "counts_as_spending" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "counts_as_spend" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "txn" DROP COLUMN "group_ref";