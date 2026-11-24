import { fileURLToPath } from 'node:url';
import { adminPort, playerPort } from '../ports.ts';
import { resolveDatabasePath } from './database-path.ts';

const serviceRoot = fileURLToPath(new URL('../', import.meta.url));

export const databasePath = resolveDatabasePath(serviceRoot);

export function readConfig() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('Set SESSION_SECRET to a random value of at least 32 bytes.');
  }

  return {
    sessionSecret,
    secureCookies: process.env.NODE_ENV === 'production',
    origins: new Set(
      (process.env.APP_ORIGINS || `http://localhost:${playerPort},http://localhost:${adminPort}`)
        .split(',')
        .map((origin) => new URL(origin.trim()).origin),
    ),
  };
}
