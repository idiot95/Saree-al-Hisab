/* Hand edits to the generated file: the txn key moved ahead of the foreign key that needs it, and the
   composite key clears only txn_id on delete (a plain SET NULL would null household_id, which is NOT NULL). */
CREATE TABLE "capture_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "capture_token_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "capture_token_hash_hex" CHECK ("capture_token"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "capture_token_label_len" CHECK (char_length("capture_token"."label") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE TABLE "sms_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"sender" text,
	"body" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body_hash" text NOT NULL,
	"parsed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "inbox_status" DEFAULT 'open' NOT NULL,
	"txn_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_draft_accepted_has_txn" CHECK ("sms_draft"."status" <> 'accepted' OR "sms_draft"."txn_id" IS NOT NULL),
	CONSTRAINT "sms_draft_body_hash_hex" CHECK ("sms_draft"."body_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sms_draft_body_len" CHECK ("sms_draft"."body" IS NULL OR char_length("sms_draft"."body") <= 2000),
	CONSTRAINT "sms_draft_sender_len" CHECK ("sms_draft"."sender" IS NULL OR char_length("sms_draft"."sender") <= 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "txn_household_key" ON "txn" USING btree ("id","household_id");--> statement-breakpoint
ALTER TABLE "capture_token" ADD CONSTRAINT "capture_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_token" ADD CONSTRAINT "capture_token_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_draft" ADD CONSTRAINT "sms_draft_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_draft" ADD CONSTRAINT "sms_draft_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_draft" ADD CONSTRAINT "sms_draft_txn_same_household" FOREIGN KEY ("txn_id","household_id") REFERENCES "public"."txn"("id","household_id") ON DELETE set null ("txn_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_token_household" ON "capture_token" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_draft_household_body" ON "sms_draft" USING btree ("household_id","body_hash");--> statement-breakpoint
CREATE INDEX "sms_draft_household_status" ON "sms_draft" USING btree ("household_id","status");