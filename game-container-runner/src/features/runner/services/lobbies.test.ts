import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { RunnerLobbySync } from '../../../../../protocol/lobbies.ts';
import { createRunnerLobbies, type LobbyNetwork } from './lobbies.ts';

await test('reconcile serializes pending launches with detachment and recovers existing networks', async () => {
  const id = randomUUID();
  const profileId = 'user-1';
  const networks: LobbyNetwork[] = [];
  const calls: string[] = [];
  const manager = createRunnerLobbies({
    inventory: async () => networks,
    create: async (lobbyId) => {
      networks.push({ id: 'network', lobbyId, profiles: [] });
      calls.push('created');
    },
    detach: async (_, dockerId) => {
      assert.equal(dockerId, 'game');
      networks[0].profiles.length = 0;
      calls.push('detached');
    },
    remove: async () => {
      networks.length = 0;
      calls.push('removed');
    },
  });
  const sync = (lobbies: RunnerLobbySync['lobbies']) => {
    const syncId = randomUUID();
    return new Promise<void>((resolve) =>
      manager.sync({ version: 4, type: 'lobby-sync', syncId, lobbies }, () => {
        assert.equal(manager.status().syncId, syncId);
        resolve();
      }),
    );
  };
  await sync([{ id, profiles: [profileId] }]);
  manager.run(async () => {
    if (manager.allows(id, profileId))
      networks[0].profiles.push({ dockerId: 'unexpected', profileId });
  });
  await sync([{ id, profiles: [] }]);
  assert.equal(networks[0].profiles.length, 0);
  await sync([{ id, profiles: [profileId] }]);
  networks[0].profiles.push({ dockerId: 'game', profileId });
  await sync([]);
  assert.deepEqual(calls, ['created', 'detached', 'removed']);
});
