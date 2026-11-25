import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '../../auth/services/schema.ts';

export const lobbies = sqliteTable('lobbies', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: integer('expires_at'),
});

export const lobbyMembers = sqliteTable(
  'lobby_members',
  {
    userId: integer('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    lobbyId: text('lobby_id')
      .notNull()
      .references(() => lobbies.id, { onDelete: 'cascade' }),
    leaving: integer('leaving', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('lobby_members_lobby').on(table.lobbyId)],
);
