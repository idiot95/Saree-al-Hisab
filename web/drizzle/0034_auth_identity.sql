CREATE TABLE "auth_identity" (
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email_at_link" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identity_provider_subject_pk" PRIMARY KEY("provider","subject"),
	CONSTRAINT "auth_identity_user_provider" UNIQUE("user_id","provider"),
	CONSTRAINT "auth_identity_provider" CHECK ("auth_identity"."provider" in ('google'))
);
--> statement-breakpoint
ALTER TABLE "auth_identity" ADD CONSTRAINT "auth_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;