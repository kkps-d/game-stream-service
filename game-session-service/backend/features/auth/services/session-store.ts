import { and, eq, gt, lte } from 'drizzle-orm';
import session from 'express-session';
import type { AuthDatabase } from '../../../database.ts';
import { sessions } from './schema.ts';

export const sessionLifetime = 8 * 60 * 60 * 1000;

export class SQLiteSessionStore extends session.Store {
  private readonly database: AuthDatabase;

  constructor(database: AuthDatabase) {
    super();
    this.database = database;
  }

  get(id: string, callback: (error: unknown, data?: session.SessionData | null) => void) {
    let data: session.SessionData | null;
    try {
      const row = this.database
        .select({ data: sessions.data })
        .from(sessions)
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
        .get();
      data = row ? (JSON.parse(row.data) as session.SessionData) : null;
    } catch (error) {
      callback(error);
      return;
    }
    callback(null, data);
  }

  set(id: string, sessionData: session.SessionData, callback?: (error?: unknown) => void) {
    try {
      const data = JSON.stringify(sessionData);
      const expiresAt = new Date(
        sessionData.cookie.expires ?? Date.now() + sessionLifetime,
      ).getTime();
      this.database.transaction((transaction) => {
        transaction.delete(sessions).where(lte(sessions.expiresAt, Date.now())).run();
        transaction
          .insert(sessions)
          .values({ id, data, expiresAt })
          .onConflictDoUpdate({ target: sessions.id, set: { data, expiresAt } })
          .run();
      });
    } catch (error) {
      callback?.(error);
      return;
    }
    callback?.();
  }

  destroy(id: string, callback?: (error?: unknown) => void) {
    try {
      this.database.delete(sessions).where(eq(sessions.id, id)).run();
    } catch (error) {
      callback?.(error);
      return;
    }
    callback?.();
  }
}
