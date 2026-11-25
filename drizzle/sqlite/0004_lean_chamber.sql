CREATE TABLE `sap_customer_monthly` (
	`customer` text NOT NULL,
	`month` text NOT NULL,
	`volume` real NOT NULL,
	`value` real NOT NULL,
	`extra_volume` real DEFAULT 0 NOT NULL,
	`extra_value` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`customer`, `month`)
);
--> statement-breakpoint
ALTER TABLE `sap_customer` ADD `sales_district` text;--> statement-breakpoint
ALTER TABLE `sap_customer` ADD `sales_office` text;