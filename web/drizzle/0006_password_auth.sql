ALTER TABLE "invite" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash");