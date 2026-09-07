CREATE TYPE "public"."split_rule" AS ENUM('equal', 'full');--> statement-breakpoint
ALTER TABLE "ledger_book" ADD COLUMN "split" "split_rule" DEFAULT 'equal' NOT NULL;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_book_id_ledger_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."ledger_book"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_book" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."book_kind";