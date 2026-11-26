ALTER TABLE "sap_billing_item" ADD COLUMN "storage_location" text;--> statement-breakpoint
ALTER TABLE "sap_customer_monthly" ADD COLUMN "project_volume" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_customer_monthly" ADD COLUMN "project_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_customer_monthly" ADD COLUMN "project_extra_volume" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_customer_monthly" ADD COLUMN "project_extra_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_sales_monthly" ADD COLUMN "project_volume" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_sales_monthly" ADD COLUMN "project_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_sales_monthly" ADD COLUMN "project_extra_volume" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sap_sales_monthly" ADD COLUMN "project_extra_value" double precision DEFAULT 0 NOT NULL;