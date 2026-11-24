import type { PlayerCatalog } from '../../../../../../protocol/games.ts';

export type PlayerAction = { type: 'play' } | { type: 'stop'; instanceId: string };

export class GameApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function checkResponse(response: Response, fallback: string) {
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new GameApiError(response.status, typeof body?.error === 'string' ? body.error : fallback);
}

export async function getPlayerCatalog(signal: AbortSignal): Promise<PlayerCatalog> {
  const response = await fetch('/api/games', { signal });
  await checkResponse(response, 'Could not load games.');
  return (await response.json()) as PlayerCatalog;
}

export async function sendPlayerAction(gameId: string, action: PlayerAction) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/${action.type}`, {
    method: 'POST',
    ...(action.type === 'stop' && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: action.instanceId }),
    }),
  });
  await checkResponse(response, 'Could not send the game command.');
}
