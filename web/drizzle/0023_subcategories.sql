-- Generated; the unique index is moved ahead of the foreign key that
-- references it, which is the one order Postgres accepts.
ALTER TABLE "category" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "category_household_key" ON "category" USING btree ("id","household_id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_same_household" FOREIGN KEY ("parent_id","household_id") REFERENCES "public"."category"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "not_its_own_parent" CHECK ("category"."parent_id" IS DISTINCT FROM "category"."id");