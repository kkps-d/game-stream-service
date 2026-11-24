import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { DockerGame, GameDocker, GameTarget } from '../types/docker.ts';
import { gameProfiles } from './games.ts';

const exec = promisify(execFile);
const runnerLabel = 'io.game-stream.runner';
const profileLabel = 'io.game-stream.profile';
const gameLabel = 'io.game-stream.game';
const instanceLabel = 'io.game-stream.instance';
const agentPort = '8080';

interface ContainerInfo {
  Id: string;
  Name: string;
  Config: { Labels: Record<string, string> | null };
  State: { Status: string; ExitCode: number; StartedAt: string; Running: boolean };
}

async function docker(args: string[], timeout = 10_000, env?: NodeJS.ProcessEnv) {
  const { stdout } = await exec('docker', args, { timeout, env });
  return stdout.trim();
}

export async function resolveDockerNetwork(name?: string, vps = false): Promise<string> {
  if (!name) return 'none';

  const details = await docker([
    'network',
    'inspect',
    '--format',
    '{{.Driver}} {{.Internal}} {{.ID}} {{index .Options "com.docker.network.bridge.name"}} {{.EnableIPv6}}',
    name,
  ]).catch((error: unknown) => {
    throw new Error(
      `Could not inspect RUNNER_DOCKER_NETWORK=${name}. Check that Docker is reachable and the network exists.`,
      { cause: error },
    );
  });
  const [driver, internal, id, bridgeName, ipv6] = details.split(' ');
  if (vps) {
    if (
      driver !== 'bridge' ||
      internal !== 'false' ||
      !id ||
      bridgeName !== 'br-game-vps' ||
      ipv6 !== 'false'
    ) {
      throw new Error('VPS games require the IPv4 Docker bridge br-game-vps.');
    }
  } else if (driver !== 'bridge' || internal !== 'true' || !id) {
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

export function createDocker(
  runnerId: string,
  gpuArgs: string[],
  network: string,
  holocureGameDir?: string,
  vps?: { ip: string; origin: string },
): GameDocker {
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
      !gameId ||
      !gameProfiles.has(gameId) ||
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
      exitCode: container.State.ExitCode,
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

    async create(game, launch) {
      const profile = gameProfiles.get(game.gameId);
      if (!profile) throw new Error(`Unknown game ID: ${game.gameId}`);

      const gameArgs: string[] = [];
      if (profile.offlineName) {
        const username = launch?.username;
        // Account logins are lowercase. The uppercase prefix keeps the ID-based fallback distinct.
        const playerName =
          username && /^[a-z0-9_]{3,16}$/.test(username)
            ? username
            : `P_${BigInt(game.profileId.slice('user-'.length)).toString(36)}`;
        gameArgs.push('--env', `MINECRAFT_OFFLINE_NAME=${playerName}`);
      }
      if (profile.gameFilesPath) {
        if (!holocureGameDir)
          throw new Error('Set HOLOCURE_GAME_DIR to the extracted HoloCure folder.');
        const source = await realpath(holocureGameDir);
        for (const file of ['HoloCure.exe', 'data.win']) {
          await access(join(source, file), constants.R_OK);
        }
        // Docker parses mount options as CSV, so quote the whole source field.
        gameArgs.push(
          '--mount',
          `type=bind,"src=${source.replaceAll('"', '""')}",dst=${profile.gameFilesPath},readonly`,
        );
      }

      const containerName = name(game);
      const agent = network === 'none' ? undefined : launch?.agent;
      if (vps) {
        const endpoint = agent && new URL(agent.url);
        if (!endpoint || endpoint.origin !== vps.origin) {
          throw new Error('Agent registration must use the configured VPS origin.');
        }
        // Pin DNS to the firewall's destination while TLS still verifies the hostname.
        gameArgs.push('--add-host', `${endpoint.hostname}:${vps.ip}`, '--dns', '127.0.0.1');
      }
      // Pass the secret through the Docker CLI environment to keep it out of its command line.
      const env = agent ? { ...process.env, GAME_STREAM_LAUNCH_TOKEN: agent.token } : undefined;
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
            ...(agent
              ? ['--env', `GAME_STREAM_AGENT_URL=${agent.url}`, '--env', 'GAME_STREAM_LAUNCH_TOKEN']
              : []),
            '--mount',
            `type=volume,src=${containerName}-saves,dst=${profile.savePath}`,
            ...gameArgs,
            profile.image,
          ],
          30_000,
          env,
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
