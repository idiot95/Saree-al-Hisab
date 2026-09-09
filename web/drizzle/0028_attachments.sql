CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"txn_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_size" CHECK ("attachment"."bytes" > 0 AND "attachment"."bytes" <= 2097152),
	CONSTRAINT "attachment_mime" CHECK ("attachment"."mime" IN ('image/jpeg','image/png','image/webp','application/pdf'))
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_txn_id_txn_id_fk" FOREIGN KEY ("txn_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_txn" ON "attachment" USING btree ("txn_id");--> statement-breakpoint
CREATE INDEX "attachment_household" ON "attachment" USING btree ("household_id");