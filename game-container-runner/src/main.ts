import { startRunnerMetrics } from '../../telemetry/runner.ts';
import { runtimeDirectory } from '../../telemetry/snapshots.ts';
import type { DockerGame } from './features/runner/types/docker.ts';
import { readConfig } from './features/runner/controller/config.ts';
import { connectRunner } from './features/runner/controller/websocket.ts';
import { runRunner } from './features/runner/services/connection.ts';
import {
  checkLobbyStreaming,
  createDocker,
  resolveDockerNetwork,
} from './features/runner/services/docker.ts';
import { resolveGpu } from './features/runner/services/gpu.ts';
import { createRunnerLobbies } from './features/runner/services/lobbies.ts';
import { createGameInstances } from './features/runner/services/instances.ts';

try {
  const config = readConfig(process.env);
  const network = await resolveDockerNetwork(config.dockerNetwork, !!config.vps);
  const lobbyStreaming =
    config.lobbyTurn && (await checkLobbyStreaming(network, config.lobbyTurn, config.vps));
  const snapshots =
    process.env.GAME_STREAM_TELEMETRY === '1' ? runtimeDirectory(config.runnerId) : undefined;
  const docker = createDocker(
    config.runnerId,
    await resolveGpu(config.gpuPci),
    network,
    config.holocureGameDir,
    config.vps,
    lobbyStreaming,
    snapshots,
  );
  const lobbies = lobbyStreaming && createRunnerLobbies(docker.lobbyNetworks);
  let games: readonly DockerGame[] | undefined;
  const instances = createGameInstances(
    docker,
    undefined,
    lobbies,
    snapshots
      ? (inventory) => {
          games = inventory;
        }
      : undefined,
  );
  const shutdown = new AbortController();
  process.once('SIGINT', () => shutdown.abort());
  process.once('SIGTERM', () => shutdown.abort());
  if (snapshots) {
    startRunnerMetrics({
      runnerId: config.runnerId,
      snapshots,
      inventory: () => games,
      readiness: () => instances.snapshot()?.containers,
      lobbyNetworks: docker.countLobbyNetworks,
      signal: shutdown.signal,
    });
  }

  console.log('Game container runner started.');
  const inventory = instances.watch(shutdown.signal);
  try {
    const result = await runRunner(
      (signal) => connectRunner(config, instances, signal),
      shutdown.signal,
    );
    if (result === 'rejected') {
      console.error('The session service rejected the runner token.');
      process.exitCode = 1;
    }
  } finally {
    shutdown.abort();
    await inventory;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The runner could not start.');
  process.exitCode = 1;
}
