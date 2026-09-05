ALTER TABLE "claim" DROP CONSTRAINT "received_not_over";--> statement-breakpoint
ALTER TABLE "claim" ALTER COLUMN "kind" SET DEFAULT 'reimbursement';--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "claim_id" uuid;--> statement-breakpoint
ALTER TABLE "claim" DROP COLUMN "person";--> statement-breakpoint
ALTER TABLE "claim" DROP COLUMN "received_amount";--> statement-breakpoint
ALTER TABLE "claim" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "receipt_points_at_a_claim" CHECK (
    ("txn"."kind" = 'claim_receipt') = ("txn"."claim_id" IS NOT NULL));