import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });

  const database = new DatabaseSync(filename, { timeout: 5000 });
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin'))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);
  `);
  return database;
}
