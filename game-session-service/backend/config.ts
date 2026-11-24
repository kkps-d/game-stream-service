import { fileURLToPath } from 'node:url';
import { adminPort, playerPort } from '../ports.ts';
import { resolveDatabasePath } from './database-path.ts';
import type { RunnerConfig } from './features/runner/types/runner.ts';

const serviceRoot = fileURLToPath(new URL('../', import.meta.url));

export const databasePath = resolveDatabasePath(serviceRoot);

function readRunnerConfig(): RunnerConfig | undefined {
  const id = process.env.RUNNER_ID;
  const token = process.env.RUNNER_TOKEN;
  if (!id && !token) return undefined;
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !token || !/^[a-zA-Z0-9._~-]{32,}$/.test(token)) {
    throw new Error('Set a valid RUNNER_ID and RUNNER_TOKEN together.');
  }
  return { id, token };
}

export function readConfig() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('Set SESSION_SECRET to a random value of at least 32 bytes.');
  }

  return {
    sessionSecret,
    runner: readRunnerConfig(),
    secureCookies: process.env.NODE_ENV === 'production',
    origins: new Set(
      (process.env.APP_ORIGINS || `http://localhost:${playerPort},http://localhost:${adminPort}`)
        .split(',')
        .map((origin) => new URL(origin.trim()).origin),
    ),
  };
}
