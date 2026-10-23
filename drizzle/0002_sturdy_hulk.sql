CREATE TABLE `audit_events` (
	`facility` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer,
	`at` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	PRIMARY KEY(`facility`, `id`),
	FOREIGN KEY (`facility`) REFERENCES `workspaces`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit_events` (`facility`,`at`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_revision` ON `audit_events` (`facility`,`revision`);--> statement-breakpoint
CREATE TABLE `operation_receipts` (
	`facility` text NOT NULL,
	`request` text NOT NULL,
	`actor` text NOT NULL,
	`hash` text NOT NULL,
	`revision` integer NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`facility`, `request`),
	FOREIGN KEY (`facility`) REFERENCES `workspaces`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operational_records` (
	`facility` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`facility`, `kind`, `id`),
	FOREIGN KEY (`facility`) REFERENCES `workspaces`(`owner`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "record_json" CHECK(json_valid("operational_records"."data"))
);
--> statement-breakpoint
CREATE TABLE `migration_snapshots` (
	`facility` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_balances` (
	`facility` text NOT NULL,
	`sku` text NOT NULL,
	`location` text NOT NULL,
	`qty` integer NOT NULL,
	`reserved` integer NOT NULL,
	PRIMARY KEY(`facility`, `sku`, `location`),
	FOREIGN KEY (`facility`) REFERENCES `workspaces`(`owner`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_integrity" CHECK("inventory_balances"."qty" >= 0 AND "inventory_balances"."reserved" >= 0 AND "inventory_balances"."reserved" <= "inventory_balances"."qty")
);
--> statement-breakpoint
CREATE INDEX `stock_location` ON `inventory_balances` (`facility`,`location`);--> statement-breakpoint
CREATE TABLE `stock_ledger` (
	`facility` text NOT NULL,
	`event` text NOT NULL,
	`sku` text NOT NULL,
	`location` text NOT NULL,
	`delta` integer NOT NULL,
	`reserved_delta` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reserved_after` integer NOT NULL,
	PRIMARY KEY(`facility`, `event`, `sku`, `location`),
	FOREIGN KEY (`facility`) REFERENCES `workspaces`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_sku` ON `stock_ledger` (`facility`,`sku`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `write_token` text;
--> statement-breakpoint
INSERT INTO migration_snapshots SELECT owner,data FROM workspaces;
--> statement-breakpoint
INSERT INTO operational_records(facility,kind,id,data) SELECT w.owner,a.key,json_extract(r.value,'$.id'),r.value FROM workspaces w,json_each(w.data) a,json_each(a.value) r WHERE a.key IN ('areas','employees','items','locations','receipts','orders','parcels','trailers','issues','notices','loads','units','returns','corrections','barcodes');
--> statement-breakpoint
INSERT INTO inventory_balances SELECT w.owner,json_extract(b.value,'$.sku'),json_extract(b.value,'$.location'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved') FROM workspaces w,json_each(w.data,'$.balances') b;
--> statement-breakpoint
INSERT INTO audit_events(facility,id,at,actor,action,detail) SELECT w.owner,json_extract(e.value,'$.id'),json_extract(e.value,'$.at'),json_extract(e.value,'$.actor'),json_extract(e.value,'$.action'),json_extract(e.value,'$.detail') FROM workspaces w,json_each(w.data,'$.audit') e;
--> statement-breakpoint
INSERT INTO stock_ledger SELECT w.owner,'opening-balance',json_extract(b.value,'$.sku'),json_extract(b.value,'$.location'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved') FROM workspaces w,json_each(w.data,'$.balances') b;
--> statement-breakpoint
UPDATE workspaces SET data=json_object('schema',1,'revision',revision,'mode',json_extract(data,'$.mode'),'facility',json_extract(data,'$.facility'));
--> statement-breakpoint
CREATE TRIGGER bootstrap_workspace AFTER INSERT ON workspaces BEGIN
INSERT INTO operational_records(facility,kind,id,data) SELECT w.owner,a.key,json_extract(r.value,'$.id'),r.value FROM (SELECT NEW.owner AS owner,NEW.data AS data) w,json_each(w.data) a,json_each(a.value) r WHERE a.key IN ('areas','employees','items','locations','receipts','orders','parcels','trailers','issues','notices','loads','units','returns','corrections','barcodes');
INSERT INTO inventory_balances SELECT w.owner,json_extract(b.value,'$.sku'),json_extract(b.value,'$.location'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved') FROM (SELECT NEW.owner AS owner,NEW.data AS data) w,json_each(w.data,'$.balances') b;
INSERT INTO audit_events(facility,id,at,actor,action,detail) SELECT w.owner,json_extract(e.value,'$.id'),json_extract(e.value,'$.at'),json_extract(e.value,'$.actor'),json_extract(e.value,'$.action'),json_extract(e.value,'$.detail') FROM (SELECT NEW.owner AS owner,NEW.data AS data) w,json_each(w.data,'$.audit') e;
INSERT INTO stock_ledger SELECT w.owner,'opening-balance',json_extract(b.value,'$.sku'),json_extract(b.value,'$.location'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved'),json_extract(b.value,'$.qty'),json_extract(b.value,'$.reserved') FROM (SELECT NEW.owner AS owner,NEW.data AS data) w,json_each(w.data,'$.balances') b;
UPDATE workspaces SET data=json_object('schema',1,'revision',revision,'mode',json_extract(data,'$.mode'),'facility',json_extract(data,'$.facility')) WHERE owner=NEW.owner;
END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_no_update BEFORE UPDATE ON stock_ledger BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_no_delete BEFORE DELETE ON stock_ledger BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE TRIGGER operation_receipts_no_update BEFORE UPDATE ON operation_receipts BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE TRIGGER operation_receipts_no_delete BEFORE DELETE ON operation_receipts BEGIN SELECT RAISE(ABORT, 'Append-only operational history'); END;
--> statement-breakpoint
CREATE INDEX memberships_facility_role ON memberships(owner,role,status);
