CREATE TABLE `design_material_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`design_key` text NOT NULL,
	`size_key` text NOT NULL,
	`design_name` text NOT NULL,
	`size_mm` text,
	`material_code` text,
	`material_name` text,
	`method` text NOT NULL,
	`confidence` real,
	`status` text NOT NULL,
	`candidates` text,
	`row_count` integer,
	`note` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_map_key` ON `design_material_map` (`design_key`,`size_key`);--> statement-breakpoint
CREATE TABLE `raw_payloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_run_id` integer,
	`kind` text NOT NULL,
	`fetched_at` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rmi_display` (
	`ref_no` text PRIMARY KEY NOT NULL,
	`display_tracker_id` integer,
	`display_date` text,
	`cohort_month` text,
	`display_date_raw` text,
	`rmi_name` text,
	`dealer_code` text,
	`dealer_name_raw` text,
	`dealer_name` text,
	`dealer_status` text,
	`zone` text,
	`region` text,
	`location` text,
	`dealer_category` text,
	`franchise_type` text,
	`displayed_where` text,
	`displayed_where_norm` text,
	`cassette_type` text,
	`cassette_type_norm` text,
	`cassette_number` text,
	`panel_no` text,
	`panel_size` text,
	`panel_size_norm` text,
	`product_type` text,
	`product_type_norm` text,
	`size_mm` text,
	`size_mm_norm` text,
	`design_name` text,
	`design_status` text,
	`status` text,
	`material_code` text,
	`map_status` text,
	`in_source` integer DEFAULT 1 NOT NULL,
	`row_hash` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`changed_at` text
);
--> statement-breakpoint
CREATE INDEX `ix_display_cohort` ON `rmi_display` (`cohort_month`);--> statement-breakpoint
CREATE INDEX `ix_display_dealer` ON `rmi_display` (`dealer_code`);--> statement-breakpoint
CREATE TABLE `rmi_product` (
	`product_code` text PRIMARY KEY NOT NULL,
	`product_name` text NOT NULL,
	`category` text,
	`size` text,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sap_billing_item` (
	`billing_document` text NOT NULL,
	`item` text NOT NULL,
	`doc_type` text,
	`doc_category` text,
	`billing_date` text,
	`sold_to` text,
	`sales_org` text,
	`dist_channel` text,
	`division` text,
	`material` text,
	`quantity` real,
	`quantity_unit` text,
	`quantity_base` real,
	`base_unit` text,
	`net_amount` real,
	`tax_amount` real,
	`currency` text,
	`is_cancelled` integer DEFAULT 0 NOT NULL,
	`last_change` text,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`billing_document`, `item`)
);
--> statement-breakpoint
CREATE INDEX `ix_bill_sold_mat` ON `sap_billing_item` (`sold_to`,`material`);--> statement-breakpoint
CREATE INDEX `ix_bill_date` ON `sap_billing_item` (`billing_date`);--> statement-breakpoint
CREATE TABLE `sap_material` (
	`material` text PRIMARY KEY NOT NULL,
	`description` text,
	`product_type` text,
	`product_group` text,
	`base_unit` text,
	`volume_per_base_unit` real,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sap_sales_monthly` (
	`dealer_code` text NOT NULL,
	`material_code` text NOT NULL,
	`month` text NOT NULL,
	`volume` real NOT NULL,
	`value` real NOT NULL,
	`line_count` integer NOT NULL,
	`volume_incomplete` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`dealer_code`, `material_code`, `month`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`rows_read` integer,
	`rows_written` integer,
	`message` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text
);
