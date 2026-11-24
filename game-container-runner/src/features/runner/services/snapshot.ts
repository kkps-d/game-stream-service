import type { RunnerContainer, RunnerSnapshot } from '../../../../../protocol/runner.ts';

export const catalog = [{ id: 'openarena', title: 'OpenArena' }];

export function createSnapshot(containers: RunnerContainer[] = []): RunnerSnapshot {
  return { version: 4, type: 'snapshot', games: catalog, containers };
}
