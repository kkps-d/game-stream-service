import { once } from 'node:events';
import { apiPort } from '../ports.ts';
import { databasePath, readConfig } from './config.ts';
import { openDatabase } from './database.ts';
import { createAgentServer } from './features/agent/controller/http.ts';
import { createAgentRegistrations } from './features/agent/services/registrations.ts';
import { createSessionServer } from './http-server.ts';

const config = readConfig();
const { db } = openDatabase(databasePath);
const agentAddress = config.agentPublicOrigin ? '127.0.0.1' : config.agentBindAddress;
const agentPort = config.agentPublicOrigin ? config.agentApiPort : apiPort;
if (config.agentPublicOrigin && agentPort === apiPort) {
  throw new Error('AGENT_API_PORT must differ from API_PORT.');
}
const agentOrigin =
  config.agentPublicOrigin ?? (agentAddress && new URL(`ws://${agentAddress}:${agentPort}`));
const registrations = agentOrigin ? createAgentRegistrations(agentOrigin) : undefined;
const server = await createSessionServer(db, config, registrations);
if (agentAddress) {
  const agentServer = createAgentServer(registrations);
  agentServer.listen(agentPort, agentAddress);
  await once(agentServer, 'listening').catch((error: unknown) => {
    throw new Error(`Could not listen for agent registration on ${agentAddress}:${agentPort}.`, {
      cause: error,
    });
  });
  console.log(`Agent API listening on http://${agentAddress}:${agentPort}`);
}
server.listen(apiPort, '127.0.0.1', () => {
  console.log(`Game session API listening on http://127.0.0.1:${apiPort}`);
});
