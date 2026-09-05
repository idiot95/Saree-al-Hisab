ALTER TABLE "claim" ADD COLUMN "counterparty_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "txn_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "written_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claim" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_counterparty_id_counterparty_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_txn_id_txn_id_fk" FOREIGN KEY ("txn_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_household" ON "claim" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "claim_counterparty" ON "claim" USING btree ("counterparty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_one_per_person_per_entry" ON "claim" USING btree ("txn_id","counterparty_id");--> statement-breakpoint
ALTER TABLE "claim" ADD CONSTRAINT "claim_amount_positive" CHECK ("claim"."expected_amount" > 0);