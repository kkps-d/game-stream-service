import type { RunnerConfig } from '../types/connection.ts';

export function readConfig(env: NodeJS.ProcessEnv): RunnerConfig & {
  runnerId: string;
  gpuPci: string;
  dockerNetwork?: string;
  holocureGameDir?: string;
} {
  const url = URL.parse(env.RUNNER_WS_URL ?? '');
  const loopback = url && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (
    !url ||
    (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Set RUNNER_WS_URL to a WSS endpoint or a loopback WS endpoint.');
  }

  const token = env.RUNNER_TOKEN;
  if (!token || !/^[a-zA-Z0-9._~-]{32,}$/.test(token)) {
    throw new Error('Set RUNNER_TOKEN to the token configured on the session service.');
  }
  const runnerId = env.RUNNER_ID || 'local';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(runnerId)) throw new Error('Set a valid RUNNER_ID.');
  const gpuPci = env.RUNNER_GPU_PCI?.trim().toLowerCase();
  if (!gpuPci || !/^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7]$/.test(gpuPci)) {
    throw new Error('Set RUNNER_GPU_PCI to the game host GPU’s PCI address.');
  }
  const dockerNetwork = env.RUNNER_DOCKER_NETWORK?.trim() || undefined;
  if (dockerNetwork && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(dockerNetwork)) {
    throw new Error('Set RUNNER_DOCKER_NETWORK to a valid Docker network name.');
  }
  const holocureGameDir = env.HOLOCURE_GAME_DIR?.trim() || undefined;
  return { url, token, runnerId, gpuPci, dockerNetwork, holocureGameDir };
}
