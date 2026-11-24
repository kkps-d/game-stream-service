import type { DatabaseSync } from 'node:sqlite';
import session from 'express-session';

export const sessionLifetime = 8 * 60 * 60 * 1000;

export class SQLiteSessionStore extends session.Store {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    super();
    this.database = database;
  }

  get(id: string, callback: (error: unknown, data?: session.SessionData | null) => void) {
    let data: session.SessionData | null;
    try {
      const row = this.database
        .prepare('SELECT data FROM sessions WHERE id = ? AND expires_at > ?')
        .get(id, Date.now());
      data = row ? (JSON.parse(String(row.data)) as session.SessionData) : null;
    } catch (error) {
      callback(error);
      return;
    }
    callback(null, data);
  }

  set(id: string, data: session.SessionData, callback?: (error?: unknown) => void) {
    try {
      this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      this.database
        .prepare(
          `
          INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
        `,
        )
        .run(
          id,
          JSON.stringify(data),
          new Date(data.cookie.expires ?? Date.now() + sessionLifetime).getTime(),
        );
    } catch (error) {
      callback?.(error);
      return;
    }
    callback?.();
  }

  destroy(id: string, callback?: (error?: unknown) => void) {
    try {
      this.database.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    } catch (error) {
      callback?.(error);
      return;
    }
    callback?.();
  }
}
