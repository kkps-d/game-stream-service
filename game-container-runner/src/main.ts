import { readConfig } from './features/runner/controller/config.ts';
import { connectRunner } from './features/runner/controller/websocket.ts';
import { runRunner } from './features/runner/services/connection.ts';
import { createDocker, resolveDockerNetwork } from './features/runner/services/docker.ts';
import { resolveGpu } from './features/runner/services/gpu.ts';
import { createGameInstances } from './features/runner/services/instances.ts';

try {
  const config = readConfig(process.env);
  const network = await resolveDockerNetwork(config.dockerNetwork, !!config.vps);
  const instances = createGameInstances(
    createDocker(
      config.runnerId,
      await resolveGpu(config.gpuPci),
      network,
      config.holocureGameDir,
      config.vps,
    ),
  );
  const shutdown = new AbortController();
  process.once('SIGINT', () => shutdown.abort());
  process.once('SIGTERM', () => shutdown.abort());

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
