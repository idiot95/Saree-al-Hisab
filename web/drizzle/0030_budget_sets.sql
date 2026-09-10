CREATE TABLE "budget_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "budget_line_amount" CHECK ("budget_line"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "budget_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"current_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_set_months" CHECK (
    date_part('day', "budget_set"."starts_on") = 1 AND date_part('day', "budget_set"."ends_on") = 1),
	CONSTRAINT "budget_set_order" CHECK ("budget_set"."ends_on" >= "budget_set"."starts_on"),
	CONSTRAINT "budget_set_named" CHECK (length(btrim("budget_set"."name")) between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_set_id_budget_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."budget_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_set" ADD CONSTRAINT "budget_set_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_line_pk" ON "budget_line" USING btree ("set_id","category_id");--> statement-breakpoint
CREATE INDEX "budget_set_household" ON "budget_set" USING btree ("household_id");--> statement-breakpoint
-- Only one set may be current at a time. A partial unique index rather than a
-- boolean and a trigger: Postgres enforces it, and "which one is current" has
-- exactly one answer by construction.
CREATE UNIQUE INDEX budget_set_one_current ON budget_set (household_id) WHERE current_at IS NOT NULL;--> statement-breakpoint

-- Carry every existing plan into a named budget, one per household, and make
-- it the current one. The plans were per category with their own ranges, so
-- the set spans the widest of them; the figures themselves are untouched.
-- Named for the month it starts in, which is the only honest thing to call a
-- budget nobody has named yet.
INSERT INTO budget_set (household_id, name, starts_on, ends_on, current_at)
SELECT p.household_id,
       'Budget from ' || to_char(min(p.starts_on), 'Mon YYYY'),
       min(p.starts_on), max(p.ends_on), now()
FROM budget_plan p
GROUP BY p.household_id;--> statement-breakpoint

INSERT INTO budget_line (set_id, category_id, amount)
SELECT s.id, p.category_id, p.amount
FROM budget_plan p
JOIN budget_set s ON s.household_id = p.household_id AND s.current_at IS NOT NULL;
