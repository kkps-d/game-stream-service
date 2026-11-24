import type { RunnerSnapshot, RunnerStatus } from '../../../../../protocol/runner.ts';

export function createRunnerRegistry(id?: string) {
  let snapshot: RunnerSnapshot | null = null;

  return {
    read(): RunnerStatus | null {
      return id ? { id, online: snapshot !== null, snapshot } : null;
    },
    update(next: RunnerSnapshot) {
      snapshot = next;
    },
    disconnect() {
      snapshot = null;
    },
  };
}

export type RunnerRegistry = ReturnType<typeof createRunnerRegistry>;
