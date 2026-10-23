import { sqliteTable, text, integer, uniqueIndex, index, primaryKey, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const workspaces = sqliteTable('workspaces', {
  owner: text('owner').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
  writeToken: text('write_token'),
});
export const records = sqliteTable('operational_records', {
  facility: text('facility').notNull().references(()=>workspaces.owner), kind:text('kind').notNull(), id:text('id').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.facility,t.kind,t.id]}),check('record_json',sql`json_valid(${t.data})`)]);
export const stock = sqliteTable('inventory_balances', {
  facility:text('facility').notNull().references(()=>workspaces.owner),sku:text('sku').notNull(),location:text('location').notNull(),qty:integer('qty').notNull(),reserved:integer('reserved').notNull(),
},t=>[primaryKey({columns:[t.facility,t.sku,t.location]}),index('stock_location').on(t.facility,t.location),check('stock_integrity',sql`${t.qty} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.qty}`)]);
export const events=sqliteTable('audit_events',{
  facility:text('facility').notNull().references(()=>workspaces.owner),id:text('id').notNull(),revision:integer('revision'),at:text('at').notNull(),actor:text('actor').notNull(),action:text('action').notNull(),detail:text('detail').notNull(),
},t=>[primaryKey({columns:[t.facility,t.id]}),index('audit_time').on(t.facility,t.at),uniqueIndex('audit_revision').on(t.facility,t.revision)]);
export const stockLedger=sqliteTable('stock_ledger',{
  facility:text('facility').notNull().references(()=>workspaces.owner),event:text('event').notNull(),sku:text('sku').notNull(),location:text('location').notNull(),delta:integer('delta').notNull(),reservedDelta:integer('reserved_delta').notNull(),balanceAfter:integer('balance_after').notNull(),reservedAfter:integer('reserved_after').notNull(),
},t=>[primaryKey({columns:[t.facility,t.event,t.sku,t.location]}),index('ledger_sku').on(t.facility,t.sku)]);
export const operations=sqliteTable('operation_receipts',{
  facility:text('facility').notNull().references(()=>workspaces.owner),request:text('request').notNull(),actor:text('actor').notNull(),hash:text('hash').notNull(),revision:integer('revision').notNull(),at:text('at').notNull(),
},t=>[primaryKey({columns:[t.facility,t.request]})]);
export const snapshots=sqliteTable('migration_snapshots',{
  facility:text('facility').primaryKey(),data:text('data').notNull(),
});
export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), userId: text('user_id').unique(),
  owner: text('owner').notNull(), role: text('role').notNull(), employee: text('employee').unique(),
  status: text('status').notNull().default('active'), version: integer('version').notNull().default(1),
});
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(), member: text('member').notNull().references(()=>memberships.id),
  endpoint: text('endpoint').notNull().unique(), subscription: text('subscription').notNull(),
});
export const pushDeliveries = sqliteTable('push_deliveries', {
  id: text('id').primaryKey(), subscriptionId: text('subscription_id').notNull(), notice: text('notice').notNull(),
  owner: text('owner').notNull(), status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0), updated: text('updated').notNull(),
}, t=>[uniqueIndex('delivery_notice_device').on(t.notice,t.subscriptionId)]);

export const authLimits=sqliteTable('auth_rate_limits',{key:text('key').primaryKey(),bucket:integer('bucket').notNull(),count:integer('count').notNull()},t=>[index('auth_bucket').on(t.bucket)]);
