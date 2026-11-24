import { once } from 'node:events';
import { apiPort } from '../ports.ts';
import { databasePath, readConfig } from './config.ts';
import { openDatabase } from './database.ts';
import { createAgentServer } from './features/agent/controller/http.ts';
import { createAgentRegistrations } from './features/agent/services/registrations.ts';
import { createSessionServer } from './http-server.ts';

const config = readConfig();
const { db } = openDatabase(databasePath);
const registrations = config.agentBindAddress
  ? createAgentRegistrations(new URL(`ws://${config.agentBindAddress}:${apiPort}`))
  : undefined;
const server = await createSessionServer(db, config, registrations);
if (config.agentBindAddress) {
  const agentServer = createAgentServer(registrations);
  agentServer.listen(apiPort, config.agentBindAddress);
  await once(agentServer, 'listening').catch((error: unknown) => {
    throw new Error(
      'Could not listen on AGENT_BIND_ADDRESS. Check the bridge gateway and API_PORT.',
      {
        cause: error,
      },
    );
  });
  console.log(`Agent API listening on http://${config.agentBindAddress}:${apiPort}`);
}
server.listen(apiPort, '127.0.0.1', () => {
  console.log(`Game session API listening on http://127.0.0.1:${apiPort}`);
});
