CREATE TABLE `sap_customer` (
	`customer` text PRIMARY KEY NOT NULL,
	`name` text,
	`full_name` text,
	`gstin` text,
	`postal_code` text,
	`created_on` text,
	`deleted` integer DEFAULT 0 NOT NULL,
	`last_seen_at` text NOT NULL
);
