import { randomUUID } from 'node:crypto';
import { STATUS_CODES, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import type { AgentRegistrations } from '../services/registrations.ts';

import type { AgentReply } from '../types/signaling.ts';

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
      const pending = new Map<string, { finish: (reply: AgentReply | null) => void }>();
      // A failed HTTP upgrade must leave the token available for a valid request.
      registrations.register(instanceId, {
        close: () => agent.close(1000, 'Game ended'),
        async request(command) {
          if (agent.readyState !== WebSocket.OPEN || pending.size >= 8) return null;
          const requestId = randomUUID();
          return new Promise((resolve) => {
            const finish = (reply: AgentReply | null) => {
              clearTimeout(timeout);
              pending.delete(requestId);
              resolve(reply);
            };
            const timeout = setTimeout(() => finish(null), 30_000).unref();
            pending.set(requestId, { finish });
            agent.send(JSON.stringify({ requestId, ...command }), (error) => {
              if (error) finish(null);
            });
          });
        },
      });
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
      agent.on('message', (data, binary) => {
        try {
          if (binary || !Buffer.isBuffer(data)) throw new Error('Expected a JSON reply');
          const reply = JSON.parse(data.toString()) as Partial<AgentReply> & {
            requestId?: unknown;
          };
          if (
            typeof reply.requestId !== 'string' ||
            typeof reply.status !== 'number' ||
            !Number.isInteger(reply.status) ||
            reply.status < 200 ||
            reply.status > 599 ||
            typeof reply.body !== 'string' ||
            !(reply.sessionId === null || typeof reply.sessionId === 'string')
          )
            throw new Error('Invalid agent reply');
          pending
            .get(reply.requestId)
            ?.finish({ status: reply.status, body: reply.body, sessionId: reply.sessionId });
        } catch {
          agent.close(1008, 'Invalid agent reply');
        }
      });
      agent.once('close', () => {
        clearInterval(heartbeat);
        for (const request of pending.values()) request.finish(null);
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
