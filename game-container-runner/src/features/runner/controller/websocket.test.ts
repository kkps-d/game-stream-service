import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { WebSocketServer } from 'ws';
import { runRunner } from '../services/connection.ts';
import { createSnapshot } from '../services/snapshot.ts';
import { readConfig } from './config.ts';
import { reportSnapshot } from './websocket.ts';

const token = 'runner-test-token-with-enough-characters';
const retry = { initialMs: 10, maximumMs: 30 };

await test(
  'reports a fresh snapshot after the connection drops',
  { timeout: 3_000 },
  async (context) => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');

    const shutdown = new AbortController();
    context.after(async () => {
      shutdown.abort();
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const received: unknown[] = [];
    const authorization: (string | undefined)[] = [];
    server.on('connection', (socket, request) => {
      authorization.push(request.headers.authorization);
      socket.once('message', (data) => {
        received.push(JSON.parse(data.toString()));
        if (received.length === 1) socket.terminate();
        else shutdown.abort();
      });
    });

    let snapshotsTaken = 0;
    const result = await runRunner(
      (signal) =>
        reportSnapshot(
          { url: new URL(`ws://127.0.0.1:${address.port}`), token },
          () => ({
            ...createSnapshot(),
            containers:
              snapshotsTaken++ === 0
                ? []
                : [{ id: 'test-container', gameId: 'openarena', state: 'running' }],
          }),
          signal,
        ),
      shutdown.signal,
      retry,
    );
    assert.equal(result, 'stopped');
    assert.deepEqual(authorization, [`Bearer ${token}`, `Bearer ${token}`]);
    assert.deepEqual(received, [
      createSnapshot(),
      {
        ...createSnapshot(),
        containers: [{ id: 'test-container', gameId: 'openarena', state: 'running' }],
      },
    ]);
  },
);

await test('stops retrying after an authorization failure', { timeout: 3_000 }, async (context) => {
  const server = createServer();
  let upgrades = 0;
  server.on('upgrade', (_request, socket) => {
    upgrades += 1;
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  const shutdown = new AbortController();
  context.after(async () => {
    shutdown.abort();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  assert.equal(
    await runRunner(
      (signal) =>
        reportSnapshot(
          { url: new URL(`ws://127.0.0.1:${address.port}`), token },
          createSnapshot,
          signal,
        ),
      shutdown.signal,
      retry,
    ),
    'rejected',
  );
  assert.equal(upgrades, 1);
});

await test('requires a secure WebSocket URL outside loopback', () => {
  assert.equal(
    readConfig({ RUNNER_WS_URL: 'wss://games.example/api/runners/connect', RUNNER_TOKEN: token })
      .url.protocol,
    'wss:',
  );
  assert.throws(
    () =>
      readConfig({ RUNNER_WS_URL: 'ws://games.example/api/runners/connect', RUNNER_TOKEN: token }),
    /WSS endpoint or a loopback WS endpoint/,
  );
});
