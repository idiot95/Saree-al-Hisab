CREATE TABLE "holding_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holding_attachment_size" CHECK ("holding_attachment"."bytes" > 0 AND "holding_attachment"."bytes" <= 2097152),
	CONSTRAINT "holding_attachment_mime" CHECK ("holding_attachment"."mime" IN ('image/jpeg','image/png','image/webp','application/pdf'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "holding_snapshot_holding_key" ON "holding_snapshot" USING btree ("id","holding_id");--> statement-breakpoint
ALTER TABLE "holding_attachment" ADD CONSTRAINT "holding_attachment_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_attachment" ADD CONSTRAINT "holding_attachment_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_attachment" ADD CONSTRAINT "holding_attachment_same_household" FOREIGN KEY ("holding_id","household_id") REFERENCES "public"."holding"("id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_attachment" ADD CONSTRAINT "holding_attachment_snapshot_same_holding" FOREIGN KEY ("snapshot_id","holding_id") REFERENCES "public"."holding_snapshot"("id","holding_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holding_attachment_holding" ON "holding_attachment" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "holding_attachment_household" ON "holding_attachment" USING btree ("household_id");