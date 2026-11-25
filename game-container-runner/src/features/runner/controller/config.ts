import { isIPv4 } from 'node:net';
import type { RunnerConfig } from '../types/connection.ts';

export function readConfig(env: NodeJS.ProcessEnv): RunnerConfig & {
  runnerId: string;
  gpuPci: string;
  dockerNetwork?: string;
  holocureGameDir?: string;
  lobbyTurn?: { ip: string; port: string };
  vps?: { ip: string; origin: string };
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
  const vpsIp = env.RUNNER_VPS_IP?.trim();
  if (vpsIp && (!isIPv4(vpsIp) || url.protocol !== 'wss:' || !dockerNetwork)) {
    throw new Error(
      'Set RUNNER_VPS_IP to the VPS IPv4 with a WSS runner URL and dedicated Docker network.',
    );
  }
  const vps = vpsIp ? { ip: vpsIp, origin: url.origin } : undefined;
  const enableLobbies = env.RUNNER_ENABLE_LAN_LOBBIES === '1';
  const turnIp = env.RUNNER_LOBBY_TURN_IP?.trim() || '172.30.42.2';
  const turnPort = env.RUNNER_LOBBY_TURN_PORT?.trim() || '3478';
  if (
    enableLobbies &&
    (!loopback ||
      vps ||
      !dockerNetwork ||
      !isIPv4(turnIp) ||
      !/^[1-9][0-9]{0,4}$/.test(turnPort) ||
      Number(turnPort) > 65535)
  ) {
    throw new Error(
      'LAN lobbies require a local runner, an internal Docker bridge, and an IPv4 TURN address.',
    );
  }
  const lobbyTurn = enableLobbies ? { ip: turnIp, port: turnPort } : undefined;
  return { url, token, runnerId, gpuPci, dockerNetwork, holocureGameDir, vps, lobbyTurn };
}
