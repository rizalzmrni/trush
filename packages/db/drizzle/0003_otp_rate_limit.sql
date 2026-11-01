CREATE TABLE "otp_rate_limit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	CONSTRAINT "otp_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "otp_rate_limit_window_start_idx" ON "otp_rate_limit" USING btree ("window_start");