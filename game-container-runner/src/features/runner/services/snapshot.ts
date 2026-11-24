import type { RunnerSnapshot } from '../../../../../protocol/runner.ts';

export function createSnapshot(): RunnerSnapshot {
  return {
    version: 1,
    type: 'snapshot',
    games: [{ id: 'openarena', title: 'OpenArena' }],
    containers: [],
  };
}
