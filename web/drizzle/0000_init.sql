CREATE TYPE "public"."account_kind" AS ENUM('spending', 'savings', 'credit', 'cash');--> statement-breakpoint
CREATE TYPE "public"."claim_kind" AS ENUM('reimbursement', 'loan', 'shared');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('open', 'part_paid', 'settled', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."due_status" AS ENUM('pending', 'paid', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."inbox_kind" AS ENUM('expected_income', 'recurring', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('open', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'adult', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."txn_kind" AS ENUM('expense', 'income', 'transfer', 'card_payment', 'claim_receipt');--> statement-breakpoint
CREATE TYPE "public"."txn_source" AS ENUM('manual', 'receipt', 'shared');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"last4" text,
	"credit_limit" bigint,
	"statement_day" integer,
	"due_day" integer,
	"archived_at" timestamp with time zone,
	CONSTRAINT "card_fields_only_on_credit" CHECK (
    "account"."kind" = 'credit'
    OR ("account"."credit_limit" IS NULL AND "account"."statement_day" IS NULL AND "account"."due_day" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"recovery_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"household_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "budget_non_negative" CHECK ("budget"."amount" >= 0),
	CONSTRAINT "budget_month_is_first" CHECK (date_part('day', "budget"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"tint" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"person" text NOT NULL,
	"kind" "claim_kind" NOT NULL,
	"expected_amount" bigint NOT NULL,
	"received_amount" bigint DEFAULT 0 NOT NULL,
	"expected_by" date,
	"status" "claim_status" DEFAULT 'open' NOT NULL,
	CONSTRAINT "received_not_over" CHECK ("claim"."received_amount" between 0 and "claim"."expected_amount")
);
--> statement-breakpoint
CREATE TABLE "claim_item" (
	"claim_id" uuid NOT NULL,
	"txn_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"push_endpoint" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_currency" text DEFAULT 'INR' NOT NULL,
	"month_starts_on" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_start_valid" CHECK ("household"."month_starts_on" between 1 and 28)
);
--> statement-breakpoint
CREATE TABLE "inbox_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "inbox_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "inbox_status" DEFAULT 'open' NOT NULL,
	"resolved_txn_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"status" "due_status" DEFAULT 'pending' NOT NULL,
	"txn_id" uuid,
	CONSTRAINT "paid_has_txn" CHECK ("occurrence"."status" <> 'paid' OR "occurrence"."txn_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint,
	"amount_from_statement" boolean DEFAULT false NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"rrule" text,
	"hijri_rule" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "amount_known_or_from_statement" CHECK (
    ("schedule"."amount" IS NOT NULL) <> "schedule"."amount_from_statement"),
	CONSTRAINT "has_a_rule" CHECK ("schedule"."rrule" IS NOT NULL OR "schedule"."hijri_rule" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "txn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "txn_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"fx_rate" integer,
	"occurred_on" date NOT NULL,
	"account_id" uuid NOT NULL,
	"counter_account_id" uuid,
	"category_id" uuid,
	"merchant" text,
	"note" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"source" "txn_source" DEFAULT 'manual' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "amount_positive" CHECK ("txn"."amount" > 0),
	CONSTRAINT "moves_have_two_sides" CHECK (
    ("txn"."kind" IN ('transfer','card_payment'))
      = ("txn"."counter_account_id" IS NOT NULL)),
	CONSTRAINT "moves_carry_no_category" CHECK (
    "txn"."kind" NOT IN ('transfer','card_payment','claim_receipt') OR "txn"."category_id" IS NULL),
	CONSTRAINT "no_self_transfer" CHECK (
    "txn"."counter_account_id" IS NULL OR "txn"."counter_account_id" <> "txn"."account_id"),
	CONSTRAINT "fx_rate_with_foreign_currency" CHECK (
    "txn"."currency" = 'INR' OR "txn"."fx_rate" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_item" ADD CONSTRAINT "claim_item_claim_id_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_item" ADD CONSTRAINT "claim_item_txn_id_txn_id_fk" FOREIGN KEY ("txn_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_item" ADD CONSTRAINT "inbox_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_item" ADD CONSTRAINT "inbox_item_resolved_txn_id_txn_id_fk" FOREIGN KEY ("resolved_txn_id") REFERENCES "public"."txn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_schedule_id_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "occurrence_txn_id_txn_id_fk" FOREIGN KEY ("txn_id") REFERENCES "public"."txn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_counter_account_id_account_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_household" ON "account" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_pk" ON "budget" USING btree ("category_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "category_unique" ON "category" USING btree ("household_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_item_pk" ON "claim_item" USING btree ("claim_id","txn_id");--> statement-breakpoint
CREATE INDEX "inbox_open" ON "inbox_item" USING btree ("household_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "member_pk" ON "member" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_unique" ON "occurrence" USING btree ("schedule_id","due_on");--> statement-breakpoint
CREATE INDEX "occurrence_due" ON "occurrence" USING btree ("status","due_on");--> statement-breakpoint
CREATE INDEX "txn_ledger" ON "txn" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "txn_category_month" ON "txn" USING btree ("category_id","occurred_on");--> statement-breakpoint
CREATE INDEX "txn_dupe_probe" ON "txn" USING btree ("account_id","amount","occurred_on");