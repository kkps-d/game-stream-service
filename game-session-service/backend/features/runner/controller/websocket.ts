import { createHash, timingSafeEqual } from 'node:crypto';
import { STATUS_CODES, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { parseSnapshot } from '../services/snapshot.ts';
import type { RunnerRegistry } from '../services/status.ts';

const route = '/api/runners/connect';

function rejectUpgrade(socket: Duplex, status: 401 | 404 | 409) {
  socket.once('error', () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    () => socket.destroy(),
  );
}

export function attachRunnerWebSocket(
  server: Server,
  registry: RunnerRegistry,
  token: string,
  heartbeatMs = 15_000,
) {
  const credentials = createHash('sha256').update(token).digest();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  let active: WebSocket | undefined;

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== route) {
      rejectUpgrade(socket, 404);
      return;
    }
    const bearer = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/i)?.[1] ?? '';
    const candidate = createHash('sha256').update(bearer).digest();
    if (!timingSafeEqual(candidate, credentials)) {
      rejectUpgrade(socket, 401);
      return;
    }
    if (active) {
      rejectUpgrade(socket, 409);
      return;
    }

    sockets.handleUpgrade(request, socket, head, (runner) => {
      active = runner;
      registry.connect((command) => {
        if (runner.readyState !== WebSocket.OPEN) return Promise.resolve(false);
        return new Promise((resolve) => {
          runner.send(JSON.stringify(command), (error) => resolve(!error));
        });
      });
      let alive = true;
      const heartbeat = setInterval(() => {
        if (!alive) {
          runner.terminate();
          return;
        }
        alive = false;
        runner.ping(undefined, false, (error) => {
          if (error) runner.terminate();
        });
      }, heartbeatMs).unref();
      runner.on('pong', () => {
        alive = true;
      });
      runner.on('error', () => runner.terminate());
      runner.on('message', (data, binary) => {
        if (runner.readyState !== WebSocket.OPEN) return;
        const text = Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data);
        const snapshot = binary ? null : parseSnapshot(text.toString());
        if (!snapshot) {
          runner.close(1008, 'Invalid runner snapshot');
          return;
        }
        registry.update(snapshot);
      });
      runner.once('close', () => {
        clearInterval(heartbeat);
        registry.disconnect();
        active = undefined;
      });
    });
  });

  server.once('close', () => {
    active?.terminate();
    sockets.close();
  });
}
