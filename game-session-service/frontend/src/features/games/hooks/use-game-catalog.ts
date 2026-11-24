import { useEffect, useState } from 'react';
import type { PlayerCatalog, PlayerGame } from '../../../../../../protocol/games.ts';
import { GameApiError, getPlayerCatalog, sendPlayerAction, type PlayerAction } from './game-api';

interface PendingCommand {
  gameId: string;
  action: PlayerAction;
  previous: PlayerGame['instance'];
}

interface CommandState {
  pending: PendingCommand | null;
  error: string | null;
}

function confirmed(catalog: PlayerCatalog, command: PendingCommand) {
  if (!catalog.runnerOnline) return false;
  const game = catalog.games.find(({ id }) => id === command.gameId);
  if (!game) return false;
  const instance = game.instance;
  if (command.action.type === 'play')
    return instance !== null && instance.id !== command.previous?.id;
  return (
    instance?.id !== command.action.instanceId ||
    instance.state === 'stopping' ||
    (Boolean(instance.error) && instance.error !== command.previous?.error)
  );
}

export function useGameCatalog(onSessionExpired: () => Promise<void>) {
  const [catalog, setCatalog] = useState<PlayerCatalog | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [{ pending, error }, setCommand] = useState<CommandState>({ pending: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const next = await getPlayerCatalog(controller.signal);
        if (controller.signal.aborted) return;
        setCatalog(next);
        setRefreshFailed(false);
        setCommand((current) =>
          current.pending && confirmed(next, current.pending)
            ? { pending: null, error: null }
            : current,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof GameApiError && error.status === 401) {
          await onSessionExpired();
          return;
        }
        setRefreshFailed(true);
      }
      timer = setTimeout(() => void poll(), 500);
    }

    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [onSessionExpired]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setCommand((current) =>
        current.pending === pending
          ? { pending: null, error: 'The runner has not confirmed the command. Try again.' }
          : current,
      );
    }, 5_000);
    return () => clearTimeout(timer);
  }, [pending]);

  async function send(game: PlayerGame, action: PlayerAction) {
    const operation = { gameId: game.id, action, previous: game.instance };
    setCommand({ pending: operation, error: null });
    try {
      await sendPlayerAction(game.id, action);
    } catch (error) {
      if (error instanceof GameApiError && error.status === 401) {
        await onSessionExpired();
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not send the game command.';
      setCommand((current) =>
        current.pending === operation ? { pending: null, error: message } : current,
      );
    }
  }

  return { catalog, pending, error, refreshFailed, send };
}
