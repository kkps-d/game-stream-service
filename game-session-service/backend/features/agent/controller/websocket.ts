import { STATUS_CODES, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import type { AgentRegistrations } from '../services/registrations.ts';

function rejectUpgrade(socket: Duplex, status: 401 | 404) {
  socket.once('error', () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    () => socket.destroy(),
  );
}

export function attachAgentWebSocket(server: Server, registrations: AgentRegistrations) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    const instanceId = request.url?.match(/^\/api\/agents\/connect\/([a-f0-9-]{36})$/)?.[1];
    if (!instanceId) {
      rejectUpgrade(socket, 404);
      return;
    }
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
    if (!token || !registrations.authorize(instanceId, token)) {
      rejectUpgrade(socket, 401);
      return;
    }

    sockets.handleUpgrade(request, socket, head, (agent) => {
      // A failed HTTP upgrade must leave the token available for a valid request.
      registrations.register(instanceId, () => agent.close(1000, 'Game ended'));
      console.info(`Agent registered for game instance ${instanceId}.`);

      let alive = true;
      const heartbeat = setInterval(() => {
        if (!alive) {
          agent.terminate();
          return;
        }
        alive = false;
        agent.ping(undefined, false, (error) => {
          if (error) agent.terminate();
        });
      }, 15_000).unref();
      agent.on('pong', () => {
        alive = true;
      });
      agent.on('error', () => agent.terminate());
      agent.on('message', () => agent.close(1008, 'Unexpected agent message'));
      agent.once('close', () => {
        clearInterval(heartbeat);
        registrations.revoke(instanceId);
        console.info(`Agent disconnected for game instance ${instanceId}.`);
      });
    });
  });
  server.once('close', () => {
    for (const agent of sockets.clients) agent.terminate();
    sockets.close();
  });
}
