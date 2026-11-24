import { createServer } from 'node:http';
import { createApp, type AppOptions } from './app.ts';
import type { AuthDatabase } from './database.ts';
import type { AgentRegistrations } from './features/agent/services/registrations.ts';
import { attachRunnerWebSocket } from './features/runner/controller/websocket.ts';
import { createRunnerRegistry } from './features/runner/services/status.ts';
import type { RunnerConfig } from './features/runner/types/runner.ts';

export interface ServerOptions extends AppOptions {
  runner?: RunnerConfig;
}

export async function createSessionServer(
  database: AuthDatabase,
  options: ServerOptions,
  registrations?: AgentRegistrations,
) {
  const registry = createRunnerRegistry(options.runner?.id, (snapshot) =>
    registrations?.sync(snapshot.containers),
  );
  const server = createServer(await createApp(database, options, registry, registrations));
  if (options.runner) attachRunnerWebSocket(server, registry, options.runner.token);
  return server;
}
