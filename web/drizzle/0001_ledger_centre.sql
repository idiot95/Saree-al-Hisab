CREATE TYPE "public"."relationship" AS ENUM('family', 'friend', 'work', 'vendor');--> statement-breakpoint
ALTER TYPE "public"."account_kind" ADD VALUE 'person';--> statement-breakpoint
ALTER TYPE "public"."claim_kind" ADD VALUE 'refund_due';--> statement-breakpoint
ALTER TYPE "public"."txn_kind" ADD VALUE 'refund';--> statement-breakpoint
CREATE TABLE "book_member" (
	"book_id" uuid NOT NULL,
	"counterparty_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counterparty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"relationship" "relationship" DEFAULT 'friend' NOT NULL,
	"tint" text DEFAULT 'neutral' NOT NULL,
	"account_id" uuid NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "duplicate_dismissed" (
	"low_id" uuid NOT NULL,
	"high_id" uuid NOT NULL,
	"dismissed_by" uuid NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordered_pair" CHECK ("duplicate_dismissed"."low_id" < "duplicate_dismissed"."high_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_book" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "book_id" uuid;--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "reverses_txn_id" uuid;--> statement-breakpoint
ALTER TABLE "book_member" ADD CONSTRAINT "book_member_book_id_ledger_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."ledger_book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_member" ADD CONSTRAINT "book_member_counterparty_id_counterparty_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty" ADD CONSTRAINT "counterparty_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty" ADD CONSTRAINT "counterparty_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_dismissed" ADD CONSTRAINT "duplicate_dismissed_low_id_txn_id_fk" FOREIGN KEY ("low_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_dismissed" ADD CONSTRAINT "duplicate_dismissed_high_id_txn_id_fk" FOREIGN KEY ("high_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_dismissed" ADD CONSTRAINT "duplicate_dismissed_dismissed_by_app_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_book" ADD CONSTRAINT "ledger_book_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_member_pk" ON "book_member" USING btree ("book_id","counterparty_id");--> statement-breakpoint
CREATE INDEX "counterparty_household" ON "counterparty" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_account" ON "counterparty" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_dismissed_pk" ON "duplicate_dismissed" USING btree ("low_id","high_id");--> statement-breakpoint
CREATE INDEX "ledger_book_household" ON "ledger_book" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "txn_book" ON "txn" USING btree ("book_id");--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "refund_points_at_a_purchase" CHECK (
    ("txn"."kind" = 'refund') = ("txn"."reverses_txn_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "refund_has_a_category" CHECK (
    "txn"."kind" <> 'refund' OR "txn"."category_id" IS NOT NULL);