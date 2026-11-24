import { isIPv4 } from 'node:net';
import type { RunnerCommand } from '../../../../../protocol/runner.ts';

export function parseCommand(text: string): RunnerCommand | null {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;

  const { version, type, gameId, profileId, instanceId, agent, username } = input as Record<
    string,
    unknown
  >;
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
  if (
    username !== undefined &&
    (typeof username !== 'string' || !/^[a-z0-9_][a-z0-9_.-]{2,31}$/.test(username))
  )
    return null;

  const play = {
    version,
    type,
    gameId,
    profileId,
    instanceId,
    ...(username && { username }),
  } as const;
  if (agent === undefined) return play;
  if (typeof agent !== 'object' || !agent) return null;
  const { url, token } = agent as Record<string, unknown>;
  if (typeof url !== 'string') return null;
  const endpoint = URL.parse(url);
  const privateIpv4 =
    endpoint &&
    isIPv4(endpoint.hostname) &&
    /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(endpoint.hostname);
  if (
    !endpoint ||
    (endpoint.protocol !== 'wss:' && !(endpoint.protocol === 'ws:' && privateIpv4)) ||
    !endpoint.hostname ||
    endpoint.username ||
    endpoint.password ||
    url.includes('?') ||
    url.includes('#') ||
    endpoint.pathname !== `/api/agents/connect/${instanceId}` ||
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return null;
  return { ...play, agent: { url: endpoint.href, token } };
}
