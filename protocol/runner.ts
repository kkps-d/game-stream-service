export interface RunnerGame {
  id: string;
  title: string;
}

export type RunnerContainerState = 'starting' | 'running' | 'stopping' | 'failed';

export interface RunnerContainer {
  id: string;
  gameId: string;
  profileId: string;
  state: RunnerContainerState;
  error?: string;
}

export interface AgentLaunch {
  url: string;
  token: string;
}

interface RunnerCommandTarget {
  version: 4;
  profileId: string;
  gameId: string;
  instanceId: string;
}

export type RunnerCommand = RunnerCommandTarget &
  ({ type: 'play'; agent?: AgentLaunch } | { type: 'stop' });

export interface RunnerSnapshot {
  version: 4;
  type: 'snapshot';
  games: RunnerGame[];
  containers: RunnerContainer[];
}

export interface RunnerStatus {
  id: string;
  online: boolean;
  snapshot: RunnerSnapshot | null;
}
