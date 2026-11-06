CREATE TYPE "public"."holding_kind" AS ENUM('fx_cash', 'metal');--> statement-breakpoint
CREATE TABLE "holding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"kind" "holding_kind" NOT NULL,
	"name" text NOT NULL,
	"currency" text,
	"metal" text,
	"purity_permille" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "holding_shape" CHECK (
    ("holding"."kind" = 'fx_cash' AND "holding"."currency" IS NOT NULL AND "holding"."metal" IS NULL AND "holding"."purity_permille" IS NULL)
    OR ("holding"."kind" = 'metal' AND "holding"."metal" IN ('gold','silver')
        AND "holding"."purity_permille" BETWEEN 1 AND 1000 AND "holding"."currency" IS NULL)),
	CONSTRAINT "holding_currency_is_a_code" CHECK ("holding"."currency" IS NULL OR "holding"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "holding_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"as_of" date NOT NULL,
	"quantity" bigint NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holding_snapshot_one_a_day" UNIQUE("holding_id","as_of"),
	CONSTRAINT "holding_snapshot_quantity_not_negative" CHECK ("holding_snapshot"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_override" (
	"household_id" uuid NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"as_of" date NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"set_by" uuid,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_override_household_id_base_quote_as_of_pk" PRIMARY KEY("household_id","base","quote","as_of"),
	CONSTRAINT "price_override_rate_positive" CHECK ("price_override"."rate" > 0),
	CONSTRAINT "price_override_codes" CHECK ("price_override"."base" ~ '^[A-Z]{3}$' AND "price_override"."quote" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "price_quote" (
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"as_of" date NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_quote_base_quote_as_of_source_pk" PRIMARY KEY("base","quote","as_of","source"),
	CONSTRAINT "price_quote_rate_positive" CHECK ("price_quote"."rate" > 0),
	CONSTRAINT "price_quote_codes" CHECK ("price_quote"."base" ~ '^[A-Z]{3}$' AND "price_quote"."quote" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_snapshot" ADD CONSTRAINT "holding_snapshot_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_snapshot" ADD CONSTRAINT "holding_snapshot_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Moved above the foreign key that needs it: drizzle-kit emits indexes last.
CREATE UNIQUE INDEX "holding_household_key" ON "holding" USING btree ("id","household_id");--> statement-breakpoint
ALTER TABLE "holding_snapshot" ADD CONSTRAINT "holding_snapshot_same_household" FOREIGN KEY ("holding_id","household_id") REFERENCES "public"."holding"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_override" ADD CONSTRAINT "price_override_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_override" ADD CONSTRAINT "price_override_set_by_app_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holding_household" ON "holding" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "holding_snapshot_household" ON "holding_snapshot" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "person_has_no_owner" CHECK ("account"."kind" <> 'person' OR "account"."owner_user_id" IS NULL);