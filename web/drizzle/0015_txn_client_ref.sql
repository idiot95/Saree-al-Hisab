ALTER TABLE "txn" ADD COLUMN "client_ref" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "txn_client_ref" ON "txn" USING btree ("household_id","client_ref") WHERE "txn"."client_ref" IS NOT NULL;