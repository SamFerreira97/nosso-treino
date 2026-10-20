CREATE TABLE `sync_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room` text NOT NULL,
	`operation` text NOT NULL,
	`item_key` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_events_operation_unique` ON `sync_events` (`operation`);--> statement-breakpoint
CREATE INDEX `events_room_seq` ON `sync_events` (`room`,`seq`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`hash` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
