import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
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
