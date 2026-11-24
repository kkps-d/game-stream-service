import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setImmediate as idle } from 'node:timers/promises';
import type { RunnerCommand } from '../../../../../protocol/runner.ts';
import type { DockerGame, GameDocker, GameTarget } from '../types/docker.ts';
import { createGameInstances } from './instances.ts';

const target = { version: 4, gameId: 'openarena', profileId: 'user-1' } as const;
function play() {
  return { ...target, type: 'play', instanceId: randomUUID() } as const;
}

function stop(instanceId: string, profileId: string = target.profileId): RunnerCommand {
  return { ...target, type: 'stop', profileId, instanceId };
}

function fakeDocker() {
  const containers = new Map<string, DockerGame>();
  const created: GameTarget[] = [];
  const started: string[] = [];
  const removed: string[] = [];
  const ready = new Set<string>();
  const docker: GameDocker = {
    async inventory() {
      return Array.from(containers.values(), (container) => ({ ...container }));
    },
    async create(game) {
      created.push(game);
      const dockerId = 'docker-' + game.id;
      containers.set(dockerId, {
        ...game,
        dockerId,
        status: 'created',
        exitCode: 0,
        startedAt: NaN,
      });
      return dockerId;
    },
    async start(dockerId) {
      started.push(dockerId);
      const container = containers.get(dockerId)!;
      container.status = 'running';
      container.startedAt = Date.now();
    },
    async remove(dockerId) {
      removed.push(dockerId);
      containers.delete(dockerId);
    },
    async ready(dockerId) {
      return ready.has(dockerId);
    },
  };
  return { docker, containers, created, started, removed, ready };
}

await test('deduplicates Play, cancels startup and ignores stale or foreign Stop', async () => {
  const { docker, created, started, removed, ready } = fakeDocker();
  const release = Promise.withResolvers<void>();
  const create = docker.create;
  docker.create = async (game) => {
    await release.promise;
    return create(game);
  };
  const runner = createGameInstances(docker);
  await runner.reconcile();

  const command = play();
  runner.dispatch(command);
  const first = runner.snapshot()!.containers[0];
  assert.equal(first.state, 'starting');
  assert.equal(first.id, command.instanceId);
  runner.dispatch(play());
  runner.dispatch(stop(first.id));
  assert.equal(runner.snapshot()!.containers[0].state, 'stopping');
  release.resolve();
  await idle();
  assert.equal(created.length, 1);
  assert.deepEqual(started, []);
  assert.deepEqual(removed, ['docker-' + first.id]);
  assert.deepEqual(runner.snapshot()!.containers, []);

  runner.dispatch(play());
  const second = runner.snapshot()!.containers[0];
  assert.notEqual(second.id, first.id);
  runner.dispatch(stop(first.id));
  runner.dispatch(stop(second.id, 'user-2'));
  runner.dispatch({ ...play(), profileId: 'user-2' });
  await idle();
  await runner.reconcile();
  assert.deepEqual(
    runner.snapshot()!.containers.map(({ state }) => state),
    ['starting', 'starting'],
  );
  for (const id of started) ready.add(id);
  await runner.reconcile();
  assert.deepEqual(
    runner.snapshot()!.containers.map(({ state }) => state),
    ['running', 'running'],
  );
  runner.dispatch(play());
  runner.dispatch(stop(second.id));
  await idle();
  assert.equal(created.length, 3);
  assert.deepEqual(
    runner.snapshot()!.containers.map(({ profileId }) => profileId),
    ['user-2'],
  );
});

await test('recovers live containers after restart and tracks Docker outages, exits and removals', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  const { docker, containers, started, ready } = fakeDocker();
  const first = createGameInstances(docker);
  await first.reconcile();
  first.dispatch(play());
  await idle();
  ready.add(started[0]);
  await first.reconcile();

  const recovered = createGameInstances(docker);
  await recovered.reconcile();
  assert.deepEqual(recovered.snapshot(), first.snapshot());

  const inventory = docker.inventory;
  docker.inventory = async () => {
    throw new Error('Docker connection lost');
  };
  await recovered.reconcile();
  assert.equal(recovered.snapshot(), null);
  docker.inventory = inventory;
  const crashed = containers.get(started[0])!;
  crashed.status = 'exited';
  crashed.exitCode = 1;
  await recovered.reconcile();
  assert.equal(recovered.snapshot()!.containers[0].state, 'failed');
  assert(recovered.snapshot()!.containers[0].error);
  containers.delete(started[0]);
  await recovered.reconcile();
  assert.deepEqual(recovered.snapshot()!.containers, []);
});

await test('cleans up a normal exit and permits a new launch', async () => {
  const { docker, containers, started, ready, removed } = fakeDocker();
  const runner = createGameInstances(docker);
  await runner.reconcile();
  const launch = play();
  runner.dispatch(launch);
  await idle();
  const first = started[0];
  ready.add(first);
  await runner.reconcile();
  assert.equal(runner.snapshot()!.containers[0].state, 'running');

  containers.get(first)!.status = 'exited';
  await runner.reconcile();
  assert.deepEqual(runner.snapshot()!.containers, []);
  assert.deepEqual(removed, [first]);

  const replay = play();
  runner.dispatch(replay);
  await idle();
  assert.equal(runner.snapshot()!.containers[0].id, replay.instanceId);
  const second = started[1];
  containers.get(second)!.status = 'exited';

  const recovered = createGameInstances(docker);
  await recovered.reconcile();
  assert.deepEqual(recovered.snapshot()!.containers, []);
  assert.deepEqual(removed, [first, second]);
});

await test('reports launch and readiness failures and allows a fresh instance on retry', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  const { docker, created, removed } = fakeDocker();
  const create = docker.create;
  docker.create = async () => {
    throw new Error('Raw diagnostics that belong in the runner log');
  };
  const runner = createGameInstances(docker, 0);
  await runner.reconcile();
  runner.dispatch(play());
  await idle();
  await runner.reconcile();

  const failed = runner.snapshot()!.containers[0];
  assert.deepEqual(
    { state: failed.state, error: failed.error },
    {
      state: 'failed',
      error: 'OpenArena could not start. Try Play again.',
    },
  );
  docker.create = create;
  runner.dispatch(play());
  await idle();
  await runner.reconcile();
  const timeout = runner.snapshot()!.containers[0];
  assert.notEqual(timeout.id, failed.id);
  assert.equal(timeout.state, 'failed');
  assert.match(timeout.error ?? '', /did not become ready/);

  runner.dispatch(play());
  await idle();
  assert.equal(created.length, 2);
  assert.deepEqual(removed, ['docker-' + timeout.id]);
});

await test('advertises the full catalog and keeps game instances separate for one player', async () => {
  const { docker, started, ready } = fakeDocker();
  const runner = createGameInstances(docker);
  await runner.reconcile();
  assert.deepEqual(runner.snapshot()!.games, [
    { id: 'openarena', title: 'OpenArena' },
    { id: 'minecraft', title: 'Minecraft 26.3' },
    { id: 'minecraft-1-21-11', title: 'Minecraft 1.21.11' },
    { id: 'holocure', title: 'HoloCure' },
  ]);

  const commands = runner.snapshot()!.games.map(({ id }) => ({ ...play(), gameId: id }));
  for (const command of commands) runner.dispatch(command);
  await idle();
  for (const id of started) ready.add(id);
  const recovered = createGameInstances(docker);
  await recovered.reconcile();
  assert.equal(recovered.snapshot()!.containers.length, 4);
  assert(recovered.snapshot()!.containers.every(({ state }) => state === 'running'));

  const [openArena, minecraft] = commands;
  recovered.dispatch({ ...minecraft, type: 'stop', instanceId: openArena.instanceId });
  assert.equal(recovered.snapshot()!.containers.length, 4);
  assert(recovered.snapshot()!.containers.every(({ state }) => state === 'running'));
  recovered.dispatch({ ...minecraft, type: 'stop' });
  await idle();
  assert.deepEqual(
    recovered.snapshot()!.containers.map(({ gameId }) => gameId),
    ['openarena', 'minecraft-1-21-11', 'holocure'],
  );
});
