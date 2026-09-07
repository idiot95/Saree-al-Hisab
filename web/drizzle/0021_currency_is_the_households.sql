ALTER TABLE "txn" DROP CONSTRAINT "fx_rate_with_foreign_currency";--> statement-breakpoint
ALTER TABLE "txn" ALTER COLUMN "currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "base_currency_is_a_code" CHECK ("household"."base_currency" ~ '^[A-Z]{3}$');