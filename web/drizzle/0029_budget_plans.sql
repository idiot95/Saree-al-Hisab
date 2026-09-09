CREATE TABLE "budget_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_plan_amount" CHECK ("budget_plan"."amount" >= 0),
	CONSTRAINT "budget_plan_months" CHECK (
    date_part('day', "budget_plan"."starts_on") = 1 AND date_part('day', "budget_plan"."ends_on") = 1),
	CONSTRAINT "budget_plan_order" CHECK ("budget_plan"."ends_on" >= "budget_plan"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "budget_plan" ADD CONSTRAINT "budget_plan_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_plan" ADD CONSTRAINT "budget_plan_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_plan_one_per_category" ON "budget_plan" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "budget_plan_household" ON "budget_plan" USING btree ("household_id");