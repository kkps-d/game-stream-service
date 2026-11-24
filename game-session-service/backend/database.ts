import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const missingSchemaMessage = 'The database schema is missing. Run npm run db:push first.';

export function openDatabase(filename: string) {
  if (!existsSync(filename)) throw new Error(missingSchemaMessage);

  const client = new Database(filename, { fileMustExist: true });
  try {
    const tableCount = client
      .prepare(
        "SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name IN ('users', 'sessions')",
      )
      .pluck()
      .get();
    if (tableCount !== 2) throw new Error(missingSchemaMessage);

    client.pragma('journal_mode = WAL');
    return {
      db: drizzle({ client }),
      close: () => client.close(),
    };
  } catch (error) {
    client.close();
    throw error;
  }
}

export type AuthDatabase = ReturnType<typeof openDatabase>['db'];
