export const lobbyIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const lobbyCodePattern = /^[A-F0-9]{10}$/;
export const maxLobbies = 32;
export const maxLobbyMembers = 16;

export interface LobbySummary {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  passwordRequired: boolean;
}

export interface LobbyDirectory {
  enabled: boolean;
  runnerOnline: boolean;
  lobbies: LobbySummary[];
  membership:
    | (LobbySummary & {
        state: "preparing" | "ready" | "leaving";
        members: string[];
      })
    | null;
}

export interface RunnerLobby {
  id: string;
  profiles: string[];
}

export interface RunnerLobbySync {
  version: 4;
  type: "lobby-sync";
  syncId: string;
  lobbies: RunnerLobby[];
}

export interface RunnerLobbyStatus {
  syncId: string | null;
  ready: string[];
}
