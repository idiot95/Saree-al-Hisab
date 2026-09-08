ALTER TABLE "occurrence" ADD COLUMN "shifted_to" date;--> statement-breakpoint
ALTER TABLE "schedule" ADD COLUMN "rule_since" date;--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "pending_is_a_move" CHECK ("occurrence"."status" <> 'pending' OR "occurrence"."shifted_to" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "occurrence" ADD CONSTRAINT "moved_elsewhere" CHECK ("occurrence"."shifted_to" IS NULL OR "occurrence"."shifted_to" <> "occurrence"."due_on");