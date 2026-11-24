import { resolve } from 'node:path';

export function resolveDatabasePath(serviceRoot: string) {
  return resolve(serviceRoot, process.env.DATABASE_PATH || '.data/game-session.sqlite');
}
