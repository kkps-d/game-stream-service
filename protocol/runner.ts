export interface RunnerGame {
  id: string;
  title: string;
}

export interface RunnerContainer {
  id: string;
  gameId: string;
  state: 'starting' | 'running' | 'exited';
}

export interface RunnerSnapshot {
  version: 1;
  type: 'snapshot';
  games: RunnerGame[];
  containers: RunnerContainer[];
}

export interface RunnerStatus {
  id: string;
  online: boolean;
  snapshot: RunnerSnapshot | null;
}
