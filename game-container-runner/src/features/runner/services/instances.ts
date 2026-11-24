import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import type { RunnerCommand, RunnerContainer } from '../../../../../protocol/runner.ts';
import type { DockerGame, GameDocker, GameLaunch, GameTarget } from '../types/docker.ts';
import { gameProfiles } from './games.ts';
import { createSnapshot } from './snapshot.ts';

interface Entry {
  view: RunnerContainer;
  dockerId?: string;
  busy: boolean;
  readyBy?: number;
}

const keyFor = ({ profileId, gameId }: Pick<GameTarget, 'profileId' | 'gameId'>) =>
  JSON.stringify([profileId, gameId]);

export function createGameInstances(docker: GameDocker, readinessMs?: number) {
  let entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let available = false;
  let inventoryError = false;
  let revision = 0;

  function snapshot() {
    if (!available) return null;
    return createSnapshot(Array.from(entries.values(), ({ view }) => ({ ...view })));
  }

  function publish() {
    revision += 1;
    for (const listener of listeners) listener();
  }

  function failed(entry: Entry, error: string) {
    entry.view = { ...entry.view, state: 'failed', error };
  }

  async function stop(key: string, entry: Entry, wasRunning: boolean) {
    const title = gameProfiles.get(entry.view.gameId)?.title ?? 'The game';
    try {
      if (entry.dockerId) await docker.remove(entry.dockerId);
      entries.delete(key);
    } catch (error) {
      console.error(`Could not stop ${title}.`, error);
      entry.view = {
        ...entry.view,
        state: wasRunning ? 'running' : 'failed',
        error: `${title} could not be stopped. Try Stop again.`,
      };
      entry.busy = false;
    }
    publish();
  }

  async function start(key: string, entry: Entry, launch: GameLaunch) {
    const title = gameProfiles.get(entry.view.gameId)?.title ?? 'The game';
    const isStopping = () => entry.view.state === 'stopping';
    try {
      if (entry.dockerId) {
        await docker.remove(entry.dockerId);
        entry.dockerId = undefined;
      }
      if (!isStopping()) {
        entry.dockerId = await docker.create(entry.view, launch);
        if (!isStopping()) await docker.start(entry.dockerId);
      }
    } catch (error) {
      console.error(`Could not start ${title}.`, error);
      if (!isStopping()) failed(entry, `${title} could not start. Try Play again.`);
    }

    if (isStopping()) {
      await stop(key, entry, false);
      return;
    }
    entry.busy = false;
    publish();
  }

  async function observe(game: DockerGame, current?: Entry): Promise<Entry> {
    const { id, profileId, gameId, dockerId, startedAt } = game;
    if (game.status === 'exited' && game.exitCode === 0) {
      return { view: { id, profileId, gameId, state: 'stopping' }, dockerId, busy: true };
    }

    const previous = current?.view.id === game.id ? current : undefined;
    if (previous?.dockerId === game.dockerId) {
      if (previous.view.state === 'running' && game.status === 'running') return previous;
      if (
        previous.view.state === 'failed' &&
        (game.status !== 'running' || previous.readyBy !== undefined)
      ) {
        return previous;
      }
    }

    const next: Entry = {
      view: { id, profileId, gameId, state: 'starting' },
      dockerId,
      busy: false,
    };
    const profile = gameProfiles.get(gameId);
    const title = profile?.title ?? 'The game';
    if (game.status !== 'running') {
      failed(next, `${title} is no longer running. Try Play again.`);
      return next;
    }

    const timeout = readinessMs ?? profile?.readinessMs ?? 20_000;
    next.readyBy = Number.isFinite(startedAt)
      ? startedAt + timeout
      : (previous?.readyBy ?? Date.now() + timeout);
    if (await docker.ready(dockerId)) {
      next.view.state = 'running';
    } else if (Date.now() >= next.readyBy) {
      console.error(`${title} readiness timed out for Docker container`, dockerId);
      failed(next, `${title} did not become ready. Try Play again.`);
    }
    return next;
  }

  async function reconcile() {
    const before = revision;
    try {
      const inventory = await docker.inventory();
      const next = new Map(
        Array.from(entries).filter(
          ([, entry]) => entry.busy || (!entry.dockerId && entry.view.state === 'failed'),
        ),
      );
      const found = await Promise.all(
        inventory.map(async (game) => {
          const key = keyFor(game);
          const current = entries.get(key);
          return current?.busy ? null : ([key, await observe(game, current)] as const);
        }),
      );
      // A scan started before a command must not overwrite that command's reservation.
      if (before !== revision) return;

      for (const entry of found) if (entry) next.set(...entry);
      const previous = snapshot();
      entries = next;
      available = true;
      inventoryError = false;
      if (!isDeepStrictEqual(previous, snapshot())) publish();

      // Cleanup starts after the entries are reserved, so Play and Stop cannot race it.
      await Promise.all(
        found.map(async (observed) => {
          if (!observed) return;
          const [key, entry] = observed;
          if (entry.view.state === 'stopping') await stop(key, entry, false);
        }),
      );
    } catch (error) {
      if (!inventoryError) console.error('Could not query the game containers.', error);
      inventoryError = true;
      if (available) {
        available = false;
        publish();
      }
    }
  }

  return {
    snapshot,
    reconcile,

    async watch(signal: AbortSignal) {
      while (!signal.aborted) {
        await reconcile();
        try {
          await delay(1_000, undefined, { signal });
        } catch (error) {
          if (!signal.aborted) throw error;
        }
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(command: RunnerCommand) {
      if (!available || !gameProfiles.has(command.gameId)) return;
      const key = keyFor(command);
      const current = entries.get(key);
      if (command.type === 'play') {
        if (current && (current.busy || current.view.state !== 'failed')) return;
        const entry: Entry = {
          view: {
            id: command.instanceId,
            gameId: command.gameId,
            profileId: command.profileId,
            state: 'starting',
          },
          dockerId: current?.dockerId,
          busy: true,
        };
        entries.set(key, entry);
        publish();
        void start(key, entry, command);
        return;
      }

      if (!current || current.view.id !== command.instanceId || current.view.state === 'stopping')
        return;
      const { busy, view } = current;
      current.view = {
        id: view.id,
        gameId: view.gameId,
        profileId: view.profileId,
        state: 'stopping',
      };
      current.busy = true;
      publish();
      if (!busy) void stop(key, current, view.state === 'running');
    },
  };
}
