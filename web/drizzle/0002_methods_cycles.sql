CREATE TYPE "public"."book_kind" AS ENUM('loan', 'reimbursement');--> statement-breakpoint
CREATE TYPE "public"."cycle_status" AS ENUM('open', 'statemented', 'paid');--> statement-breakpoint
CREATE TYPE "public"."method_kind" AS ENUM('upi', 'card', 'netbanking', 'cash', 'cheque', 'wallet', 'autodebit');--> statement-breakpoint
CREATE TABLE "card_cycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"statement_on" date NOT NULL,
	"due_on" date NOT NULL,
	"statement_amount" bigint,
	"status" "cycle_status" DEFAULT 'open' NOT NULL,
	"paid_txn_id" uuid,
	CONSTRAINT "period_ordered" CHECK ("card_cycle"."period_end" > "card_cycle"."period_start"),
	CONSTRAINT "due_after_statement" CHECK ("card_cycle"."due_on" >= "card_cycle"."statement_on"),
	CONSTRAINT "paid_has_a_payment" CHECK ("card_cycle"."status" <> 'paid' OR "card_cycle"."paid_txn_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "method_kind" NOT NULL,
	"funding_account_id" uuid NOT NULL,
	"handle" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ledger_book" ADD COLUMN "kind" "book_kind" DEFAULT 'reimbursement' NOT NULL;--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "payment_method_id" uuid;--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "card_cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "card_cycle" ADD CONSTRAINT "card_cycle_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_funding_account_id_account_id_fk" FOREIGN KEY ("funding_account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_unique" ON "card_cycle" USING btree ("account_id","period_start");--> statement-breakpoint
CREATE INDEX "cycle_due" ON "card_cycle" USING btree ("status","due_on");--> statement-breakpoint
CREATE INDEX "method_household" ON "payment_method" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "method_account" ON "payment_method" USING btree ("funding_account_id");--> statement-breakpoint
CREATE INDEX "txn_cycle" ON "txn" USING btree ("card_cycle_id");