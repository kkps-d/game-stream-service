import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DockerGame, GameDocker, GameTarget } from '../types/docker.ts';

const exec = promisify(execFile);
const image = 'containerz/openarena:dev';
const runnerLabel = 'io.game-stream.runner';
const profileLabel = 'io.game-stream.profile';
const gameLabel = 'io.game-stream.game';
const instanceLabel = 'io.game-stream.instance';
const agentPort = '8080';

interface ContainerInfo {
  Id: string;
  Name: string;
  Config: { Labels: Record<string, string> | null };
  State: { Status: string; StartedAt: string; Running: boolean };
}

async function docker(args: string[], timeout = 10_000) {
  const { stdout } = await exec('docker', args, { timeout });
  return stdout.trim();
}

export async function resolveDockerNetwork(name?: string): Promise<string> {
  if (!name) return 'none';

  const details = await docker([
    'network',
    'inspect',
    '--format',
    '{{.Driver}} {{.Internal}} {{.ID}}',
    name,
  ]).catch((error: unknown) => {
    throw new Error(
      `Could not inspect RUNNER_DOCKER_NETWORK=${name}. Check that Docker is reachable and the network exists.`,
      { cause: error },
    );
  });
  const [driver, internal, id] = details.split(' ');
  if (driver !== 'bridge' || internal !== 'true' || !id) {
    throw new Error(`RUNNER_DOCKER_NETWORK=${name} must be an internal Docker bridge.`);
  }
  return id;
}

function containerMissing(error: unknown) {
  const failure = error as { stderr?: string };
  return (
    typeof failure?.stderr === 'string' && /No such (?:container|object):/i.test(failure.stderr)
  );
}

async function inspect(id: string): Promise<ContainerInfo | null> {
  try {
    return JSON.parse(
      await docker(['container', 'inspect', '--format', '{{json .}}', id]),
    ) as ContainerInfo;
  } catch (error) {
    if (containerMissing(error)) return null;
    throw error;
  }
}

export function createDocker(runnerId: string, gpuArgs: string[], network: string): GameDocker {
  const owner = `${runnerLabel}=${runnerId}`;
  const name = (game: Pick<GameTarget, 'profileId' | 'gameId'>) =>
    `game-stream-${runnerId}-${game.profileId}-${game.gameId}`;

  function own(container: ContainerInfo): DockerGame | null {
    const labels = container.Config.Labels;
    const id = labels?.[instanceLabel];
    const profileId = labels?.[profileLabel];
    const gameId = labels?.[gameLabel];
    if (
      labels?.[runnerLabel] !== runnerId ||
      gameId !== 'openarena' ||
      !profileId ||
      !/^user-[1-9][0-9]*$/.test(profileId) ||
      !id ||
      !/^[\da-f-]{36}$/i.test(id) ||
      container.Name !== '/' + name({ gameId, profileId })
    ) {
      return null;
    }
    return {
      id,
      gameId,
      profileId,
      dockerId: container.Id,
      status: container.State.Status,
      startedAt: Date.parse(container.State.StartedAt),
    };
  }

  return {
    async inventory() {
      const ids = await docker([
        'container',
        'ls',
        '--all',
        '--no-trunc',
        '--filter',
        `label=${owner}`,
        '--format',
        '{{.ID}}',
      ]);
      if (!ids) return [];
      const containers = await Promise.all(ids.split('\n').map(inspect));
      return containers.flatMap((container) => {
        const game = container && own(container);
        return game ? [game] : [];
      });
    },

    async create(game) {
      const containerName = name(game);
      try {
        return await docker(
          [
            'container',
            'create',
            '--name',
            containerName,
            '--pull',
            'never',
            '--network',
            network,
            '--stop-timeout',
            '15',
            '--ulimit',
            'core=0',
            '--label',
            owner,
            '--label',
            `${profileLabel}=${game.profileId}`,
            '--label',
            `${gameLabel}=${game.gameId}`,
            '--label',
            `${instanceLabel}=${game.id}`,
            ...gpuArgs,
            '--env',
            `CONTAINERZ_AGENT_PORT=${agentPort}`,
            '--env',
            'CONTAINERZ_AGENT_BIND_ADDRESS=127.0.0.1',
            '--mount',
            `type=volume,src=${containerName}-saves,dst=/home/player/.openarena`,
            image,
          ],
          30_000,
        );
      } catch (error) {
        // The daemon may have created the container even if the CLI timed out.
        const container = await inspect(containerName).catch(() => null);
        const recovered = container && own(container);
        if (recovered?.id === game.id) return recovered.dockerId;
        throw error;
      }
    },

    async start(dockerId) {
      await docker(['container', 'start', dockerId], 30_000);
    },

    async remove(dockerId) {
      const container = await inspect(dockerId);
      if (!container) return;
      if (!own(container)) throw new Error('Docker container does not belong to this runner.');
      try {
        if (container.State.Running) await docker(['container', 'stop', dockerId], 30_000);
        await docker(['container', 'rm', dockerId]);
      } catch (error) {
        if (!containerMissing(error)) throw error;
      }
    },

    async ready(dockerId) {
      try {
        const status = await docker(
          [
            'container',
            'exec',
            dockerId,
            'curl',
            '--silent',
            '--noproxy',
            '*',
            '--max-time',
            '1',
            '--output',
            '/dev/null',
            '--write-out',
            '%{http_code}',
            `http://127.0.0.1:${agentPort}/offer`,
          ],
          3_000,
        );
        return status === '405';
      } catch {
        return false;
      }
    },
  };
}
