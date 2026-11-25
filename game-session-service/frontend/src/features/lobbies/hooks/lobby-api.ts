import type { LobbyDirectory } from '../../../../../../protocol/lobbies.ts';
import { GameApiError } from '../../games/hooks/game-api';

async function check(response: Response) {
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new GameApiError(
    response.status,
    typeof body?.error === 'string' ? body.error : 'Could not complete the lobby request.',
  );
}

export async function getLobbies(signal?: AbortSignal): Promise<LobbyDirectory> {
  const response = await fetch('/api/lobbies', { signal });
  await check(response);
  return (await response.json()) as LobbyDirectory;
}

export type LobbyAction =
  | { type: 'create'; name: string; password: string }
  | { type: 'join'; code: string; password: string }
  | { type: 'leave' };

export async function sendLobbyAction({ type, ...body }: LobbyAction) {
  const response = await fetch(type === 'create' ? '/api/lobbies' : `/api/lobbies/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await check(response);
}
