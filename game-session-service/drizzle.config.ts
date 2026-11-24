import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'drizzle-kit';
import { resolveDatabasePath } from './backend/database-path.ts';

if (existsSync('.env')) loadEnvFile('.env');
const databasePath = resolveDatabasePath(process.cwd());
mkdirSync(dirname(databasePath), { recursive: true });

export default defineConfig({
  dialect: 'sqlite',
  schema: './backend/features/auth/services/schema.ts',
  dbCredentials: { url: databasePath },
});
