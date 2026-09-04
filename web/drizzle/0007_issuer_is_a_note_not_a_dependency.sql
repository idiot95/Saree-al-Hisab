ALTER TABLE "invite" DROP CONSTRAINT "invite_invited_by_app_user_id_fk";
--> statement-breakpoint
ALTER TABLE "password_reset" DROP CONSTRAINT "password_reset_issued_by_app_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invite" ALTER COLUMN "invited_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset" ALTER COLUMN "issued_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_by_app_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_issued_by_app_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;