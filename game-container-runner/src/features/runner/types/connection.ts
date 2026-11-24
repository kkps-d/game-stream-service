import type { RunnerCommand, RunnerSnapshot } from '../../../../../protocol/runner.ts';

export type ConnectionResult = 'reported' | 'unavailable' | 'rejected';
export type ConnectRunner = (signal: AbortSignal) => Promise<ConnectionResult>;

export interface RunnerConfig {
  url: URL;
  token: string;
}

export interface RunnerControl {
  snapshot(): RunnerSnapshot | null;
  subscribe(listener: () => void): () => void;
  dispatch(command: RunnerCommand): void;
}
