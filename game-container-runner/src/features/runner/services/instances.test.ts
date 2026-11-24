import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { RunnerCommand } from '../../../../../protocol/runner.ts';
import { createGameInstances } from './instances.ts';

const play = { version: 2, type: 'play', gameId: 'openarena', profileId: 'user-1' } as const;

function stop(instanceId: string): RunnerCommand {
  return { version: 2, type: 'stop', gameId: 'openarena', profileId: play.profileId, instanceId };
}

await test('cancels startup, deduplicates Play, and rejects stale or foreign Stop commands', async () => {
  const runner = createGameInstances(10);
  const updates: string[] = [];
  runner.subscribe(() => updates.push(runner.snapshot().containers[0]?.state ?? 'idle'));

  runner.dispatch(play);
  const first = runner.snapshot().containers[0];
  assert.equal(first.state, 'starting');
  runner.dispatch(play);
  assert.deepEqual(runner.snapshot().containers, [first]);

  runner.dispatch(stop(first.id));
  runner.dispatch(stop(first.id));
  runner.dispatch(play);
  assert.equal(runner.snapshot().containers[0].state, 'stopping');
  await delay(20);
  assert.deepEqual(updates, ['starting', 'stopping', 'idle']);
  assert.deepEqual(runner.snapshot().containers, []);

  runner.dispatch(play);
  const second = runner.snapshot().containers[0];
  assert.notEqual(second.id, first.id);
  runner.dispatch(stop(first.id));
  runner.dispatch({ ...stop(second.id), profileId: 'user-2' });
  runner.dispatch({ ...play, profileId: 'user-2' });
  await delay(20);
  assert.deepEqual(
    runner.snapshot().containers.map(({ profileId, state }) => ({ profileId, state })),
    [
      { profileId: 'user-1', state: 'running' },
      { profileId: 'user-2', state: 'running' },
    ],
  );

  runner.dispatch(play);
  assert.equal(runner.snapshot().containers[0].id, second.id);
  runner.dispatch(stop(second.id));
  await delay(20);
  assert.deepEqual(
    runner.snapshot().containers.map(({ profileId }) => profileId),
    ['user-2'],
  );
  assert.deepEqual(createGameInstances().snapshot().containers, []);
});
