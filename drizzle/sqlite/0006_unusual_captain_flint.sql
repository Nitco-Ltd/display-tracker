ALTER TABLE `sap_billing_item` ADD `storage_location` text;--> statement-breakpoint
ALTER TABLE `sap_customer_monthly` ADD `project_volume` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_customer_monthly` ADD `project_value` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_customer_monthly` ADD `project_extra_volume` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_customer_monthly` ADD `project_extra_value` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_sales_monthly` ADD `project_volume` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_sales_monthly` ADD `project_value` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_sales_monthly` ADD `project_extra_volume` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sap_sales_monthly` ADD `project_extra_value` real DEFAULT 0 NOT NULL;