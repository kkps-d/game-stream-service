import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { RunnerLobbySync } from '../../../../../protocol/lobbies.ts';
import { openDatabase } from '../../../database.ts';
import { createAccount } from '../../auth/services/accounts.ts';
import { createRunnerRegistry } from '../../runner/services/status.ts';
import { createLobbyService, LobbyError } from './lobbies.ts';

await test('lobby membership, authorization, reconnect, and expiry are independent of games', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'game-session-lobbies-'));
  const filename = join(directory, 'lobbies.sqlite');
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const serviceRoot = new URL('../../../../', import.meta.url);
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('node_modules/drizzle-kit/bin.js', serviceRoot)), 'push'],
    { cwd: fileURLToPath(serviceRoot), env: { ...process.env, DATABASE_PATH: filename } },
  );
  const database = openDatabase(filename);
  context.after(database.close);
  await createAccount(database.db, 'creator', 'test-lobby-password', 'user');
  await createAccount(database.db, 'guest', 'test-lobby-password', 'user');
  const runners = createRunnerRegistry('local');
  let command: RunnerLobbySync | undefined;
  let time = 10_000;
  const service = createLobbyService(database.db, runners, () => time);
  const connect = () => {
    runners.connect(async (next) => {
      assert.equal(next.type, 'lobby-sync');
      command = next;
      return true;
    });
    runners.update({
      version: 4,
      type: 'snapshot',
      games: [],
      containers: [],
      lobbies: { syncId: null, ready: [] },
    });
  };
  const confirm = async () => {
    assert(command);
    runners.update({
      version: 4,
      type: 'snapshot',
      games: [],
      containers: [],
      lobbies: { syncId: command.syncId, ready: command.lobbies.map(({ id }) => id) },
    });
    await service.sync();
  };

  await assert.rejects(service.create(1, 'Friday LAN', 'room-password'), { status: 503 });
  connect();
  await service.create(1, 'Friday LAN', 'room-password');
  const [lobby] = service.list(2, 'day lan').lobbies;
  assert.equal(service.list(2, lobby.code.toLowerCase()).lobbies[0]?.id, lobby.id);
  assert.deepEqual(Object.keys(lobby).sort(), [
    'code',
    'id',
    'memberCount',
    'name',
    'passwordRequired',
  ]);
  assert.equal(service.launch(1), null);
  assert.equal(service.launch(2), undefined);
  await confirm();
  assert.equal(service.launch(1), lobby.id);
  await assert.rejects(service.join(2, lobby.code, 'wrong password'), { status: 403 });
  await service.join(2, lobby.code, 'room-password');
  await assert.rejects(service.create(2, 'Other LAN', ''), { status: 409 });
  await confirm();
  assert.equal(service.launch(2), lobby.id);

  runners.disconnect();
  await service.leave(1);
  assert.equal(service.list(1, '').membership?.state, 'leaving');
  assert.equal(service.launch(1), null);
  connect();
  await service.sync();
  assert.deepEqual(command?.lobbies, [{ id: lobby.id, profiles: ['user-2'] }]);
  await confirm();
  assert.equal(service.launch(1), undefined);
  assert.equal(service.launch(2), lobby.id);

  await service.leave(2);
  await confirm();
  assert.equal(service.list(2, '').lobbies[0]?.memberCount, 0);
  time += 5 * 60_000;
  await assert.rejects(service.join(1, lobby.code, 'room-password'), LobbyError);
  await service.sync();
  assert.deepEqual(command?.lobbies, []);
  await confirm();
  assert.deepEqual(service.list(1, '').lobbies, []);
});
