import type { RunnerLobbyStatus, RunnerLobbySync } from "./lobbies.ts";

export interface RunnerGame {
  id: string;
  title: string;
}

export type RunnerContainerState =
  "starting" | "running" | "stopping" | "failed";

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

export type GameRunnerCommand = RunnerCommandTarget &
  (
    | { type: "play"; agent?: AgentLaunch; username?: string; lobbyId?: string }
    | { type: "stop" }
  );

export type RunnerCommand = GameRunnerCommand | RunnerLobbySync;

export interface RunnerSnapshot {
  version: 4;
  type: "snapshot";
  games: RunnerGame[];
  containers: RunnerContainer[];
  lobbies?: RunnerLobbyStatus;
}

export interface RunnerStatus {
  id: string;
  online: boolean;
  snapshot: RunnerSnapshot | null;
}
