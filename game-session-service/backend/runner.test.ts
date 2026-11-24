import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import WebSocket from 'ws';
import type { RunnerSnapshot, RunnerStatus } from '../../protocol/runner.ts';
import { openDatabase } from './database.ts';
import { createAgentServer } from './features/agent/controller/http.ts';
import { createAgentRegistrations } from './features/agent/services/registrations.ts';
import { createAccount } from './features/auth/services/accounts.ts';
import { attachRunnerWebSocket } from './features/runner/controller/websocket.ts';
import { createRunnerRegistry } from './features/runner/services/status.ts';
import { createSessionServer } from './http-server.ts';

const origin = 'http://localhost:5180';
const token = 'runner-test-token-with-enough-characters';
const password = 'test-account-password';
const snapshot: RunnerSnapshot = {
  version: 4,
  type: 'snapshot',
  games: [{ id: 'openarena', title: 'OpenArena' }],
  containers: [],
};

async function waitForStatus(read: () => Promise<RunnerStatus | null>, expected: RunnerStatus) {
  let current: RunnerStatus | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    current = await read();
    if (isDeepStrictEqual(current, expected)) break;
    await delay(10);
  }
  assert.deepEqual(current, expected);
}

await test(
  'authenticates runner upgrades and exposes only current snapshots to admins',
  { timeout: 5_000 },
  async (context) => {
    const directory = mkdtempSync(join(tmpdir(), 'game-session-runner-'));
    const filename = join(directory, 'runner.sqlite');
    const removeDirectory = () => rmSync(directory, { recursive: true, force: true });
    let cleanup: () => void | Promise<void> = removeDirectory;
    context.after(() => cleanup());
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('../node_modules/drizzle-kit/bin.js', import.meta.url)), 'push'],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, DATABASE_PATH: filename },
      },
    );

    const database = openDatabase(filename);
    const registrations = createAgentRegistrations(new URL('ws://127.0.0.1'));
    const agentServer = createAgentServer(registrations);
    const server = await createSessionServer(
      database.db,
      {
        sessionSecret: 'test-secret-test-secret-test-secret',
        origins: new Set([origin]),
        secureCookies: false,
        runner: { id: 'local', token },
      },
      registrations,
    );

    const clients = new Set<WebSocket>();
    cleanup = async () => {
      try {
        for (const socket of clients) socket.terminate();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await new Promise<void>((resolve) => agentServer.close(() => resolve()));
        database.close();
      } finally {
        removeDirectory();
      }
    };
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const { port } = address;
    agentServer.listen(0, '127.0.0.1');
    await once(agentServer, 'listening');
    const agentAddress = agentServer.address();
    assert(agentAddress && typeof agentAddress !== 'string');
    const { port: agentPort } = agentAddress;

    await createAccount(database.db, 'player', password, 'user');
    await createAccount(database.db, 'operator', password, 'admin');
    await createAccount(database.db, 'other', password, 'user');

    function request(path: string, init?: RequestInit) {
      return fetch(`http://127.0.0.1:${port}/api/${path}`, init);
    }

    async function signIn(username: string) {
      const result = await request('sign-in', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      assert.equal(result.status, 200);
      const cookie = result.headers.get('set-cookie');
      assert(cookie);
      return cookie.split(';')[0];
    }

    function connect(credential?: string) {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/runners/connect`, {
        headers: credential ? { Authorization: `Bearer ${credential}` } : {},
      });
      clients.add(socket);
      socket.once('close', () => clients.delete(socket));
      return socket;
    }

    assert.equal((await request('health')).status, 200);
    assert.equal((await request('admin/runner')).status, 401);
    const player = await signIn('player');
    const other = await signIn('other');
    assert.equal((await request('games')).status, 401);

    function games(
      cookie: string,
      suffix = '',
      action?: { instanceId?: string; profileId?: string },
    ) {
      return request('games' + suffix, {
        method: action ? 'POST' : 'GET',
        headers: {
          Cookie: cookie,
          ...(action && { Origin: origin, 'Content-Type': 'application/json' }),
        },
        body: action ? JSON.stringify(action) : undefined,
      });
    }

    assert.deepEqual(await (await games(player)).json(), { runnerOnline: false, games: [] });
    assert.equal((await games(player, '/openarena/play', {})).status, 503);
    assert.equal((await games(player, '/openarena/stop', { instanceId: 'old' })).status, 503);

    assert.equal((await request('admin/runner', { headers: { Cookie: player } })).status, 403);
    const admin = await signIn('operator');
    async function status() {
      const response = await request('admin/runner', { headers: { Cookie: admin } });
      assert.equal(response.status, 200);
      const body = (await response.json()) as { runner: RunnerStatus | null };
      return body.runner;
    }
    const offline = { id: 'local', online: false, snapshot: null };
    assert.deepEqual(await status(), offline);

    for (const credential of [undefined, 'wrong-token']) {
      const denied = connect(credential);
      const [error] = (await once(denied, 'error')) as [Error];
      assert.match(error.message, /Unexpected server response: 401/);
    }

    const first = connect(token);
    await once(first, 'open');
    assert.deepEqual(await status(), offline);
    const duplicate = connect(token);
    const [duplicateError] = (await once(duplicate, 'error')) as [Error];
    assert.match(duplicateError.message, /Unexpected server response: 409/);

    first.send(JSON.stringify(snapshot));
    await waitForStatus(status, { id: 'local', online: true, snapshot });

    assert.equal((await games(player, '/missing/play', {})).status, 404);
    assert.equal((await games(player, '/openarena/stop', {})).status, 400);
    const playCommand = once(first, 'message');
    assert.equal((await games(player, '/openarena/play', { profileId: 'user-3' })).status, 202);
    const [playMessage] = await playCommand;
    const { instanceId, agent, ...command } = JSON.parse(playMessage.toString());
    assert.match(instanceId, /^[a-f0-9-]{36}$/);
    assert.equal(agent.url, `ws://127.0.0.1/api/agents/connect/${instanceId}`);
    assert.match(agent.token, /^[a-f0-9]{64}$/);
    assert.deepEqual(command, {
      version: 4,
      type: 'play',
      profileId: 'user-1',
      gameId: 'openarena',
    });

    const playing: RunnerSnapshot = {
      ...snapshot,
      containers: [{ id: instanceId, gameId: 'openarena', profileId: 'user-1', state: 'starting' }],
    };
    first.send(JSON.stringify(playing));
    await waitForStatus(status, { id: 'local', online: true, snapshot: playing });
    assert.deepEqual(await (await games(player)).json(), {
      runnerOnline: true,
      games: [
        {
          id: 'openarena',
          title: 'OpenArena',
          instance: { id: instanceId, state: 'starting' },
        },
      ],
    });
    assert.deepEqual(await (await games(other)).json(), {
      runnerOnline: true,
      games: [{ id: 'openarena', title: 'OpenArena', instance: null }],
    });
    assert.equal((await games(other, '/openarena/stop', { instanceId })).status, 404);
    assert.equal((await games(player, '/openarena/stop', { instanceId: 'old' })).status, 404);

    function connectAgent(id: string, bearer: string) {
      const connection = new WebSocket(`ws://127.0.0.1:${agentPort}/api/agents/connect/${id}`, {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      clients.add(connection);
      connection.once('close', () => clients.delete(connection));
      return connection;
    }

    for (const [id, bearer] of [
      [randomUUID(), agent.token],
      [instanceId, '0'.repeat(64)],
    ]) {
      const rejected = connectAgent(id, bearer);
      const [error] = (await once(rejected, 'error')) as [Error];
      assert.match(error.message, /Unexpected server response: 401/);
    }
    const activeAgent = connectAgent(instanceId, agent.token);
    await once(activeAgent, 'open');
    const replay = connectAgent(instanceId, agent.token);
    const [replayError] = (await once(replay, 'error')) as [Error];
    assert.match(replayError.message, /Unexpected server response: 401/);

    const stopCommand = once(first, 'message');
    assert.equal((await games(player, '/openarena/stop', { instanceId })).status, 202);
    const [stopMessage] = await stopCommand;
    assert.deepEqual(JSON.parse(stopMessage.toString()), {
      version: 4,
      type: 'stop',
      profileId: 'user-1',
      gameId: 'openarena',
      instanceId,
    });

    const agentClosed = once(activeAgent, 'close');
    first.send(
      JSON.stringify({
        ...playing,
        containers: [{ ...playing.containers[0], state: 'stopping' }],
      }),
    );
    const [agentCloseCode] = await agentClosed;
    assert.equal(agentCloseCode, 1000);

    const invalidClosed = once(first, 'close');
    first.send(JSON.stringify({ ...snapshot, version: 1 }));
    const [invalidCode] = await invalidClosed;
    assert.equal(invalidCode, 1008);
    await waitForStatus(status, offline);

    const second = connect(token);
    await once(second, 'open');
    const updated: RunnerSnapshot = {
      ...snapshot,
      containers: [
        { id: 'test-container', gameId: 'openarena', profileId: 'user-1', state: 'running' },
      ],
    };
    second.send(JSON.stringify(updated));
    await waitForStatus(status, { id: 'local', online: true, snapshot: updated });
    second.close();
    await once(second, 'close');
    await waitForStatus(status, offline);
  },
);

await test(
  'drops an unresponsive runner after a missed pong',
  { timeout: 3_000 },
  async (context) => {
    const server = createServer();
    const registry = createRunnerRegistry('local');
    attachRunnerWebSocket(server, registry, token, 20);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/runners/connect`, {
      autoPong: false,
      headers: { Authorization: `Bearer ${token}` },
    });
    context.after(async () => {
      client.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    await once(client, 'open');
    const closed = once(client, 'close');
    client.send(JSON.stringify(snapshot));
    const [code] = await closed;
    assert.equal(code, 1006);
    await waitForStatus(async () => registry.read(), {
      id: 'local',
      online: false,
      snapshot: null,
    });
  },
);
