import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  hash: text('hash').primaryKey(),
  createdAt: integer('created_at').notNull(),
});
export const events = sqliteTable('sync_events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  room: text('room').notNull(),
  operation: text('operation').notNull().unique(),
  itemKey: text('item_key').notNull(),
  payload: text('payload').notNull(),
}, t => [index('events_room_seq').on(t.room, t.seq)]);
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
