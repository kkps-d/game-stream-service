import { createServer } from 'node:http';
import { createApp, type AppOptions } from './app.ts';
import type { AuthDatabase } from './database.ts';
import { attachRunnerWebSocket } from './features/runner/controller/websocket.ts';
import { createRunnerRegistry } from './features/runner/services/status.ts';
import type { RunnerConfig } from './features/runner/types/runner.ts';

export interface ServerOptions extends AppOptions {
  runner?: RunnerConfig;
}

export async function createSessionServer(database: AuthDatabase, options: ServerOptions) {
  const registry = createRunnerRegistry(options.runner?.id);
  const server = createServer(await createApp(database, options, registry));
  if (options.runner) attachRunnerWebSocket(server, registry, options.runner.token);
  return server;
}
