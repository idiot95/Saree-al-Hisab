ALTER TABLE "app_user" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "has_an_identity" CHECK ("app_user"."email" IS NOT NULL OR "app_user"."phone" IS NOT NULL);