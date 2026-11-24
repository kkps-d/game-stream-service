import type { RunnerCommand } from '../../../../../protocol/runner.ts';

export function parseCommand(text: string): RunnerCommand | null {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;

  const { version, type, gameId, profileId, instanceId, agent } = input as Record<string, unknown>;
  if (
    version !== 4 ||
    typeof gameId !== 'string' ||
    !gameId ||
    typeof profileId !== 'string' ||
    !/^user-[1-9][0-9]*$/.test(profileId)
  ) {
    return null;
  }
  if (typeof instanceId !== 'string' || !instanceId) return null;
  if (type === 'stop') return { version, type, gameId, profileId, instanceId };
  if (type !== 'play' || !/^[a-f0-9-]{36}$/.test(instanceId)) return null;

  if (agent === undefined) return { version, type, gameId, profileId, instanceId };
  if (typeof agent !== 'object' || !agent) return null;
  const { url, token } = agent as Record<string, unknown>;
  const endpoint = typeof url === 'string' ? URL.parse(url) : null;
  if (
    !endpoint ||
    endpoint.protocol !== 'ws:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== `/api/agents/connect/${instanceId}` ||
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return null;
  return { version, type, gameId, profileId, instanceId, agent: { url: endpoint.href, token } };
}
