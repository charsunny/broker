CREATE TABLE IF NOT EXISTS "commission_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"product_name" text NOT NULL,
	"premium_term" text NOT NULL,
	"investor_status" text NOT NULL,
	"effective_date" date NOT NULL,
	"effective_end_date" date,
	"status" text DEFAULT 'Draft' NOT NULL,
	"rates_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product" (
	"product_name" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_slots" jsonb DEFAULT '["productName","premiumTerm","investorStatus"]'::jsonb NOT NULL,
	"single_pay" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unhandled_query" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_config_version" ON "commission_config" USING btree ("product_name","premium_term","investor_status","effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_config_active" ON "commission_config" USING btree ("status","product_name");