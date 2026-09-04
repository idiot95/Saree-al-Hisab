CREATE TABLE "password_reset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "invite" DROP CONSTRAINT "invite_token_unique";--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_issued_by_app_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_user" ON "password_reset" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "invite" DROP COLUMN "token";--> statement-breakpoint
-- Normalise before insisting on it, or the constraint cannot be added.
UPDATE "app_user" SET "email" = lower("email")
  WHERE "email" IS NOT NULL AND "email" <> lower("email");--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "email_is_lowercase" CHECK ("app_user"."email" IS NULL OR "app_user"."email" = lower("app_user"."email"));--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "password_needs_an_address" CHECK ("app_user"."password_hash" IS NULL OR "app_user"."email" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "attempts_not_negative" CHECK ("app_user"."failed_attempts" >= 0);