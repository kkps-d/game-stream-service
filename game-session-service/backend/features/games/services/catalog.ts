import { randomUUID } from 'node:crypto';
import type { PlayerCatalog } from '../../../../../protocol/games.ts';
import type { AgentRegistrations } from '../../agent/services/registrations.ts';
import type { RunnerRegistry } from '../../runner/services/status.ts';
import type { GameAction, GameCommandResult } from '../types/action.ts';

export function createGamesService(
  runners: RunnerRegistry,
  registrations?: AgentRegistrations,
  streaming = false,
) {
  return {
    list(accountId: number): PlayerCatalog {
      const snapshot = runners.read()?.snapshot;
      if (!snapshot) return { runnerOnline: false, games: [] };

      const profileId = `user-${accountId}`;
      return {
        runnerOnline: true,
        games: snapshot.games.map((game) => {
          const instance = snapshot.containers.find(
            (container) => container.profileId === profileId && container.gameId === game.id,
          );
          return {
            ...game,
            instance: instance
              ? {
                  id: instance.id,
                  state: instance.state,
                  ...(streaming &&
                    instance.state === 'running' &&
                    registrations?.connection(instance.id, profileId, game.id) && {
                      streamReady: true,
                    }),
                  ...(instance.error && { error: instance.error }),
                }
              : null,
          };
        }),
      };
    },

    async send(accountId: number, gameId: string, action: GameAction): Promise<GameCommandResult> {
      const snapshot = runners.read()?.snapshot;
      if (!snapshot) return 'unavailable';
      if (!snapshot.games.some(({ id }) => id === gameId)) return 'not-found';

      const profileId = `user-${accountId}`;
      if (
        action.type === 'stop' &&
        !snapshot.containers.some(
          (container) =>
            container.profileId === profileId &&
            container.gameId === gameId &&
            container.id === action.instanceId,
        )
      ) {
        return 'not-found';
      }

      if (action.type === 'stop') {
        const sent = await runners.send({ version: 4, profileId, gameId, ...action });
        return sent ? 'accepted' : 'unavailable';
      }

      if (
        snapshot.containers.some(
          (container) =>
            container.profileId === profileId &&
            container.gameId === gameId &&
            container.state !== 'failed',
        )
      )
        return 'accepted';

      const instanceId = randomUUID();
      const agent = registrations?.issue(instanceId, profileId, gameId);
      if (agent === null) return 'accepted';
      const sent = await runners.send({
        version: 4,
        type: 'play',
        profileId,
        gameId,
        instanceId,
        ...(agent && { agent }),
      });
      if (!sent) registrations?.revoke(instanceId);
      return sent ? 'accepted' : 'unavailable';
    },
  };
}
