CREATE TYPE "public"."schedule_kind" AS ENUM('expense', 'income');--> statement-breakpoint
ALTER TABLE "schedule" ADD COLUMN "kind" "schedule_kind" DEFAULT 'expense' NOT NULL;