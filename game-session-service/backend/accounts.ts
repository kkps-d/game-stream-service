import { hash } from '@node-rs/argon2';
import type { DatabaseSync } from 'node:sqlite';

export interface Account {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

export async function createAccount(
  database: DatabaseSync,
  username: string,
  password: string,
  role: Account['role'],
) {
  if (!/^[a-z0-9_][a-z0-9_.-]{2,31}$/i.test(username)) {
    throw new Error('Use 3–32 letters, numbers, dots, dashes, or underscores for the username.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('Use a password between 12 and 128 characters.');
  }

  const passwordHash = await hash(password);
  database
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username.toLowerCase(), passwordHash, role);
}
