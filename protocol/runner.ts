export interface RunnerGame {
  id: string;
  title: string;
}

export type RunnerContainerState = 'starting' | 'running' | 'stopping';

export interface RunnerContainer {
  id: string;
  gameId: string;
  profileId: string;
  state: RunnerContainerState;
}

interface RunnerCommandTarget {
  version: 2;
  profileId: string;
  gameId: string;
}

export type RunnerCommand = RunnerCommandTarget &
  ({ type: 'play' } | { type: 'stop'; instanceId: string });

export interface RunnerSnapshot {
  version: 2;
  type: 'snapshot';
  games: RunnerGame[];
  containers: RunnerContainer[];
}

export interface RunnerStatus {
  id: string;
  online: boolean;
  snapshot: RunnerSnapshot | null;
}
