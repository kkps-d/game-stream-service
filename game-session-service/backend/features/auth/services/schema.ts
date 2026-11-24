import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { accountRoles } from '../types/account.ts';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey(),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: accountRoles }).notNull(),
  },
  (table) => [
    check('users_username_lowercase', sql`${table.username} = lower(${table.username})`),
    check('users_role_check', sql`${table.role} IN ('user', 'admin')`),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(),
    data: text('data').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    // SQLite permits NULL in a text primary key, and Kit omits the NOT NULL clause.
    check('sessions_id_required', sql`${table.id} IS NOT NULL`),
    index('sessions_expiry').on(table.expiresAt),
  ],
);
