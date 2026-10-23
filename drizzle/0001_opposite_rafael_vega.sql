CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`employee` text,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_email_unique` ON `memberships` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_user_id_unique` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_employee_unique` ON `memberships` (`employee`);--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`notice` text NOT NULL,
	`owner` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_notice_device` ON `push_deliveries` (`notice`,`subscription_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`endpoint` text NOT NULL,
	`subscription` text NOT NULL,
	FOREIGN KEY (`member`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);