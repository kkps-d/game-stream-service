import type { RunnerConfig } from '../types/connection.ts';

export function readConfig(env: NodeJS.ProcessEnv): RunnerConfig {
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
  return { url, token };
}
