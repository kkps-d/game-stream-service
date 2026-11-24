import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createAgentRegistrations } from '../services/registrations.ts';
import { createAgentServer } from './http.ts';

await test('the agent listener serves health without exposing session or runner routes', async (context) => {
  const server = createAgentServer();
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });

  for (const path of ['/api/session', '/api/games', '/api/runners/connect']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  assert.equal((await fetch(`${base}/api/health`, { method: 'POST' })).status, 404);
});

await test('an expired launch token cannot upgrade the agent connection', async (context) => {
  const registrations = createAgentRegistrations(new URL('ws://127.0.0.1'));
  const instanceId = randomUUID();
  const staleClock = context.mock.method(Date, 'now', () => 0);
  const launch = registrations.issue(instanceId, 'user-1', 'openarena');
  staleClock.mock.restore();
  assert(launch);
  const server = createAgentServer(registrations);
  context.after(() => {
    registrations.revoke(instanceId);
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  const endpoint = new URL(launch.url);
  endpoint.port = String(address.port);
  const socket = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${launch.token}` } });
  const [error] = (await once(socket, 'error')) as [Error];
  assert.match(error.message, /Unexpected server response: 401/);
});
