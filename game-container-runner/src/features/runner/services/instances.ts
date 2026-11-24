import { randomUUID } from 'node:crypto';
import type { RunnerCommand, RunnerContainer } from '../../../../../protocol/runner.ts';
import type { RunnerControl } from '../types/connection.ts';
import { catalog, createSnapshot } from './snapshot.ts';

interface Instance {
  container: RunnerContainer;
  transition: NodeJS.Timeout;
}

export function createGameInstances(transitionMs = 1_500): RunnerControl {
  const instances = new Map<string, Instance>();
  const listeners = new Set<() => void>();

  function publish() {
    for (const listener of listeners) listener();
  }

  return {
    snapshot() {
      return createSnapshot(Array.from(instances.values(), ({ container }) => ({ ...container })));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(command: RunnerCommand) {
      if (!catalog.some(({ id }) => id === command.gameId)) return;
      const key = JSON.stringify([command.profileId, command.gameId]);
      const current = instances.get(key);
      if (command.type === 'play') {
        if (current) return;
        const container: RunnerContainer = {
          id: randomUUID(),
          gameId: command.gameId,
          profileId: command.profileId,
          state: 'starting',
        };
        const transition = setTimeout(() => {
          container.state = 'running';
          publish();
        }, transitionMs).unref();
        instances.set(key, { container, transition });
      } else {
        if (
          !current ||
          current.container.id !== command.instanceId ||
          current.container.state === 'stopping'
        )
          return;
        clearTimeout(current.transition);
        current.container.state = 'stopping';
        current.transition = setTimeout(() => {
          instances.delete(key);
          publish();
        }, transitionMs).unref();
      }
      publish();
    },
  };
}
