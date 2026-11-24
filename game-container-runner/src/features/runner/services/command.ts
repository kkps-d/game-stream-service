import type { RunnerCommand } from '../../../../../protocol/runner.ts';

export function parseCommand(text: string): RunnerCommand | null {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;

  const { version, type, gameId, profileId, instanceId } = input as Record<string, unknown>;
  if (
    version !== 3 ||
    typeof gameId !== 'string' ||
    !gameId ||
    typeof profileId !== 'string' ||
    !/^user-[1-9][0-9]*$/.test(profileId)
  ) {
    return null;
  }
  if (type === 'play') return { version, type, gameId, profileId };
  if (type === 'stop' && typeof instanceId === 'string' && instanceId) {
    return { version, type, gameId, profileId, instanceId };
  }
  return null;
}
