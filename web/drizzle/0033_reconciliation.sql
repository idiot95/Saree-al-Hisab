ALTER TYPE "public"."txn_kind" ADD VALUE 'adjust_in';--> statement-breakpoint
ALTER TYPE "public"."txn_kind" ADD VALUE 'adjust_out';--> statement-breakpoint
CREATE TABLE "reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"statement_on" date NOT NULL,
	"statement_balance" bigint NOT NULL,
	"adjustment_txn_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "txn" DROP CONSTRAINT "moves_carry_no_category";--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "reconciled_id" uuid;--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "counter_reconciled_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_adjustment_txn_id_txn_id_fk" FOREIGN KEY ("adjustment_txn_id") REFERENCES "public"."txn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reconciliation_account" ON "reconciliation" USING btree ("account_id","statement_on");--> statement-breakpoint
CREATE INDEX "reconciliation_household" ON "reconciliation" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_reconciled_id_reconciliation_id_fk" FOREIGN KEY ("reconciled_id") REFERENCES "public"."reconciliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_counter_reconciled_id_reconciliation_id_fk" FOREIGN KEY ("counter_reconciled_id") REFERENCES "public"."reconciliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "moves_carry_no_category" CHECK (
    "txn"."kind" NOT IN ('card_payment','claim_receipt','adjust_in','adjust_out') OR "txn"."category_id" IS NULL);