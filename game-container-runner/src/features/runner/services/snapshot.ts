import type { RunnerContainer, RunnerSnapshot } from '../../../../../protocol/runner.ts';
import { gameProfiles } from './games.ts';

const catalog = Array.from(gameProfiles, ([id, { title }]) => ({ id, title }));

export function createSnapshot(containers: RunnerContainer[] = []): RunnerSnapshot {
  return { version: 4, type: 'snapshot', games: catalog, containers };
}
