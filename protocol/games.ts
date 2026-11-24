import type { RunnerContainerState, RunnerGame } from './runner.ts';

export interface PlayerGame extends RunnerGame {
  instance: { id: string; state: RunnerContainerState; error?: string } | null;
}

export interface PlayerCatalog {
  runnerOnline: boolean;
  games: PlayerGame[];
}
