import type { AgentLaunch, RunnerContainer } from '../../../../../protocol/runner.ts';

export type GameTarget = Pick<RunnerContainer, 'id' | 'gameId' | 'profileId'>;

export interface GameLaunch {
  agent?: AgentLaunch;
  username?: string;
}

export interface DockerGame extends GameTarget {
  dockerId: string;
  status: string;
  exitCode: number;
  startedAt: number;
}

export interface GameDocker {
  inventory(): Promise<DockerGame[]>;
  create(game: GameTarget, launch?: GameLaunch): Promise<string>;
  start(dockerId: string): Promise<void>;
  remove(dockerId: string): Promise<void>;
  ready(dockerId: string): Promise<boolean>;
}
