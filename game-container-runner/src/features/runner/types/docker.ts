import type { RunnerContainer } from '../../../../../protocol/runner.ts';

export type GameTarget = Pick<RunnerContainer, 'id' | 'gameId' | 'profileId'>;

export interface DockerGame extends GameTarget {
  dockerId: string;
  status: string;
  startedAt: number;
}

export interface GameDocker {
  inventory(): Promise<DockerGame[]>;
  create(game: GameTarget): Promise<string>;
  start(dockerId: string): Promise<void>;
  remove(dockerId: string): Promise<void>;
  ready(dockerId: string): Promise<boolean>;
}
