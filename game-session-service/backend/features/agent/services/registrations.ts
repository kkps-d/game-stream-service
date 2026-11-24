import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AgentLaunch, RunnerContainer } from '../../../../../protocol/runner.ts';

import type { AgentConnection } from '../types/signaling.ts';

interface Launch {
  profileId: string;
  gameId: string;
  tokenHash: Buffer;
  expiresAt: number;
  expiration: NodeJS.Timeout;
  seen: boolean;
  connection?: AgentConnection;
}

const tokenLifetimeMs = 120_000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest();
}

export function createAgentRegistrations(origin: URL) {
  const launches = new Map<string, Launch>();

  function revoke(instanceId: string) {
    const launch = launches.get(instanceId);
    if (!launch) return;
    launches.delete(instanceId);
    clearTimeout(launch.expiration);
    launch.connection?.close();
  }

  return {
    issue(instanceId: string, profileId: string, gameId: string): AgentLaunch | null {
      if (
        [...launches.values()].some(
          (launch) => launch.profileId === profileId && launch.gameId === gameId,
        )
      ) {
        return null;
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + tokenLifetimeMs;
      const expiration = setTimeout(() => revoke(instanceId), tokenLifetimeMs).unref();
      launches.set(instanceId, {
        profileId,
        gameId,
        tokenHash: hashToken(token),
        expiresAt,
        expiration,
        seen: false,
      });
      return { token, url: new URL(`/api/agents/connect/${instanceId}`, origin).href };
    },

    authorize(instanceId: string, token: string) {
      const launch = launches.get(instanceId);
      return (
        !!launch &&
        !launch.connection &&
        launch.expiresAt > Date.now() &&
        timingSafeEqual(launch.tokenHash, hashToken(token))
      );
    },

    register(instanceId: string, connection: AgentConnection) {
      const launch = launches.get(instanceId)!;
      clearTimeout(launch.expiration);
      launch.connection = connection;
    },

    connection(instanceId: string, profileId: string, gameId: string) {
      const launch = launches.get(instanceId);
      if (launch?.profileId === profileId && launch.gameId === gameId) return launch.connection;
    },

    sync(containers: RunnerContainer[]) {
      const instances = new Map(containers.map((instance) => [instance.id, instance]));
      for (const [id, launch] of launches) {
        const instance = instances.get(id);
        if (instance) {
          if (
            instance.profileId !== launch.profileId ||
            instance.gameId !== launch.gameId ||
            instance.state === 'stopping' ||
            instance.state === 'failed'
          ) {
            revoke(id);
          } else {
            launch.seen = true;
          }
        } else if (launch.seen) {
          // An earlier snapshot can omit a launch that the runner has yet to start.
          revoke(id);
        }
      }
    },

    revoke,
  };
}

export type AgentRegistrations = ReturnType<typeof createAgentRegistrations>;
