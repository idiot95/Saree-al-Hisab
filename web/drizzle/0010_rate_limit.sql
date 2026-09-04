CREATE TABLE "rate_limit" (
	"bucket" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL
);
