import type { RunnerLobbyStatus, RunnerLobbySync } from '../../../../../protocol/lobbies.ts';

export interface LobbyNetwork {
  id: string;
  lobbyId: string;
  profiles: { dockerId: string; profileId: string }[];
}

export interface LobbyDocker {
  inventory(): Promise<LobbyNetwork[]>;
  create(lobbyId: string): Promise<void>;
  detach(networkId: string, dockerId: string): Promise<void>;
  remove(networkId: string): Promise<void>;
}

export function createRunnerLobbies(docker: LobbyDocker) {
  let pending: RunnerLobbySync | undefined;
  let applied: RunnerLobbySync | undefined;
  let scheduled = false;
  let queue = Promise.resolve();

  function run(operation: () => Promise<void>) {
    queue = queue
      .then(operation)
      .catch(() => console.error('Could not reconcile LAN lobby networking.'));
  }

  return {
    run,
    status(): RunnerLobbyStatus {
      return { syncId: applied?.syncId ?? null, ready: applied?.lobbies.map(({ id }) => id) ?? [] };
    },
    allows(lobbyId: string, profileId: string) {
      return (
        !!applied &&
        applied === pending &&
        applied.lobbies.some(({ id, profiles }) => id === lobbyId && profiles.includes(profileId))
      );
    },
    sync(command: RunnerLobbySync, publish: () => void) {
      if (pending?.syncId !== command.syncId) pending = command;
      if (scheduled || applied === pending) return;
      scheduled = true;
      run(async () => {
        const desired = pending!;
        try {
          const networks = await docker.inventory();
          const byLobby = new Map(
            desired.lobbies.map(({ id, profiles }) => [id, new Set(profiles)]),
          );
          for (const network of networks) {
            const profiles = byLobby.get(network.lobbyId);
            for (const { dockerId, profileId } of network.profiles) {
              if (!profiles?.has(profileId)) await docker.detach(network.id, dockerId);
            }
            if (!profiles) await docker.remove(network.id);
          }
          const existing = new Set(networks.map(({ lobbyId }) => lobbyId));
          for (const { id } of desired.lobbies) if (!existing.has(id)) await docker.create(id);
          applied = desired;
          publish();
        } finally {
          scheduled = false;
        }
      });
    },
  };
}

export type RunnerLobbyManager = ReturnType<typeof createRunnerLobbies>;
