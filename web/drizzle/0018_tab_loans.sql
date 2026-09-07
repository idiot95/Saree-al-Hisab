ALTER TABLE "txn" DROP CONSTRAINT "moves_carry_no_category";--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "group_ref" uuid;--> statement-breakpoint
CREATE INDEX "txn_group" ON "txn" USING btree ("group_ref");--> statement-breakpoint
ALTER TABLE "ledger_book" DROP COLUMN "split";--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "moves_carry_no_category" CHECK (
    "txn"."kind" NOT IN ('card_payment','claim_receipt') OR "txn"."category_id" IS NULL);--> statement-breakpoint
DROP TYPE "public"."split_rule";