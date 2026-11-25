import { createLobbyService } from './features/lobbies/services/lobbies.ts';
import { lobbies as lobbyTable, lobbyMembers } from './features/lobbies/services/schema.ts';
import { createServer } from 'node:http';
import { createApp, type AppOptions } from './app.ts';
import type { AuthDatabase } from './database.ts';
import type { AgentRegistrations } from './features/agent/services/registrations.ts';
import { attachRunnerWebSocket } from './features/runner/controller/websocket.ts';
import { createRunnerRegistry } from './features/runner/services/status.ts';
import type { RunnerConfig } from './features/runner/types/runner.ts';

export interface ServerOptions extends AppOptions {
  runner?: RunnerConfig;
  enableLobbies?: boolean;
}

export async function createSessionServer(
  database: AuthDatabase,
  options: ServerOptions,
  registrations?: AgentRegistrations,
) {
  const registry = createRunnerRegistry(options.runner?.id, (snapshot) =>
    registrations?.sync(snapshot.containers),
  );
  if (options.enableLobbies) {
    try {
      database.select().from(lobbyTable).limit(1).all();
      database.select().from(lobbyMembers).limit(1).all();
    } catch (error) {
      throw new Error('Could not read the lobby schema. Run npm run db:push first.', {
        cause: error,
      });
    }
  }
  const lobbies = options.enableLobbies ? createLobbyService(database, registry) : undefined;
  const server = createServer(await createApp(database, options, registry, registrations, lobbies));
  if (lobbies) {
    const timer = setInterval(() => {
      void lobbies.sync().catch(() => console.error('Could not synchronize LAN lobbies.'));
    }, 1_000).unref();
    server.on('close', () => clearInterval(timer));
  }
  if (options.runner) attachRunnerWebSocket(server, registry, options.runner.token);
  return server;
}
