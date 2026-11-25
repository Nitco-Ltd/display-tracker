CREATE TABLE "sap_customer_monthly" (
	"customer" text NOT NULL,
	"month" text NOT NULL,
	"volume" double precision NOT NULL,
	"value" double precision NOT NULL,
	"extra_volume" double precision DEFAULT 0 NOT NULL,
	"extra_value" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "sap_customer_monthly_customer_month_pk" PRIMARY KEY("customer","month")
);
--> statement-breakpoint
ALTER TABLE "sap_customer" ADD COLUMN "sales_district" text;--> statement-breakpoint
ALTER TABLE "sap_customer" ADD COLUMN "sales_office" text;