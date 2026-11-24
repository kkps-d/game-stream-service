import type {
  RunnerContainer,
  RunnerGame,
  RunnerSnapshot,
} from '../../../../../protocol/runner.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isGame(value: unknown): value is RunnerGame {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.title);
}

function isContainer(value: unknown): value is RunnerContainer {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.gameId) &&
    (value.state === 'starting' || value.state === 'running' || value.state === 'exited')
  );
}

export function parseSnapshot(text: string): RunnerSnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.type !== 'snapshot' ||
    !Array.isArray(value.games) ||
    !value.games.every(isGame) ||
    !Array.isArray(value.containers) ||
    !value.containers.every(isContainer)
  ) {
    return null;
  }

  const games = value.games.map(({ id, title }) => ({ id, title }));
  const containers = value.containers.map(({ id, gameId, state }) => ({ id, gameId, state }));
  const gameIds = new Set(games.map(({ id }) => id));
  if (
    gameIds.size !== games.length ||
    new Set(containers.map(({ id }) => id)).size !== containers.length ||
    containers.some(({ gameId }) => !gameIds.has(gameId))
  ) {
    return null;
  }

  return { version: 1, type: 'snapshot', games, containers };
}
