import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import Database from 'better-sqlite3';
import { DrizzleQueryError, eq, sql } from 'drizzle-orm';
import type { AuthDatabase } from '../../../database.ts';
import type { Account, AccountRole, SignInRequest } from '../types/account.ts';
import { users } from './schema.ts';

function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new Error('Use a password between 12 and 128 characters.');
  }
  return hash(password);
}

export async function createAccount(
  database: AuthDatabase,
  username: string,
  password: string,
  role: AccountRole,
) {
  if (!/^[a-z0-9_][a-z0-9_.-]{2,31}$/i.test(username)) {
    throw new Error('Use 3–32 letters, numbers, dots, dashes, or underscores for the username.');
  }
  const passwordHash = await hashPassword(password);
  try {
    database.insert(users).values({ username: username.toLowerCase(), passwordHash, role }).run();
  } catch (error) {
    const cause = error instanceof DrizzleQueryError ? error.cause : error;
    if (cause instanceof Database.SqliteError && cause.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('That username is already in use.', { cause: error });
    }
    throw new Error('Could not save the account.', { cause: error });
  }
}

export async function changeAccountPassword(
  database: AuthDatabase,
  username: string,
  password: string,
) {
  const passwordHash = await hashPassword(password);
  let changes: number;
  try {
    ({ changes } = database
      .update(users)
      .set({ passwordHash })
      .where(eq(users.username, sql`lower(${username})`))
      .run());
  } catch (error) {
    throw new Error('Could not save the password.', { cause: error });
  }
  if (changes === 0) throw new Error('Account not found.');
}

export async function createAccountService(database: AuthDatabase) {
  const missingAccountHash = await hash(randomBytes(32));

  return {
    async verifyCredentials({ username, password }: SignInRequest): Promise<Account | undefined> {
      const account = database
        .select()
        .from(users)
        .where(eq(users.username, sql`lower(${username})`))
        .get();
      const valid = await verify(account?.passwordHash ?? missingAccountHash, password);
      if (account && valid) {
        return { id: account.id, username: account.username, role: account.role };
      }
    },

    findById(id: number): Account | undefined {
      return database
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(eq(users.id, id))
        .get();
    },
  };
}
