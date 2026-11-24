import { Gamepad2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Empty, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty';
import { Spinner } from '@/shared/components/ui/spinner';
import { useGameCatalog } from '../hooks/use-game-catalog';

const gameCovers: ReadonlyMap<string, string> = new Map([
  ['openarena', new URL('../assets/openarena.webp', import.meta.url).href],
  ['minecraft', new URL('../assets/minecraft.webp', import.meta.url).href],
  ['minecraft-1-21-11', new URL('../assets/minecraft-1-21-11.webp', import.meta.url).href],
  ['holocure', new URL('../assets/holocure.webp', import.meta.url).href],
]);

const gameStatus = {
  idle: '',
  starting: 'Starting game…',
  running: 'Waiting for stream…',
  ready: 'Stream ready',
  stopping: 'Stopping…',
  failed: 'Game failed',
};

export function GameCatalog({ onSessionExpired }: { onSessionExpired: () => Promise<void> }) {
  const { catalog, pending, error, refreshFailed, send } = useGameCatalog(onSessionExpired);
  const controlsDisabled = !!pending || refreshFailed || !catalog?.runnerOnline;

  return (
    <div className="grid min-w-0 gap-4">
      {refreshFailed ? (
        <Alert role="status">
          <AlertDescription>Could not refresh games. Retrying…</AlertDescription>
        </Alert>
      ) : !catalog ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          Loading games…
        </p>
      ) : !catalog.runnerOnline ? (
        <Alert role="status">
          <AlertDescription>Game server offline. New sessions are unavailable.</AlertDescription>
        </Alert>
      ) : catalog.games.length === 0 ? (
        <Empty role="status">
          <EmptyHeader>
            <EmptyTitle>No games available.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="min-w-0 wrap-anywhere">{error}</AlertDescription>
        </Alert>
      )}
      {!!catalog?.games.length && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-4">
          {catalog.games.map((game) => {
            const cover = gameCovers.get(game.id);
            const instance = game.instance;
            const pendingAction = pending?.gameId === game.id ? pending.action.type : null;
            let state: keyof typeof gameStatus = instance?.state ?? 'idle';
            if (pendingAction === 'play') state = 'starting';
            if (pendingAction === 'stop') state = 'stopping';
            if (state === 'running' && instance?.streamReady) state = 'ready';
            const changing = state === 'starting' || state === 'stopping';
            const playLabel = state === 'failed' ? 'Retry' : 'Play';
            return (
              <li key={game.id} className="grid min-w-0 content-start gap-1.5">
                <div
                  className="game-cover relative mb-1.5 grid aspect-2/3 place-items-center overflow-hidden bg-muted text-primary"
                  aria-hidden="true"
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      width={500}
                      height={750}
                      decoding="async"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <Gamepad2 className="size-9" />
                  )}
                </div>
                <h2 className="leading-tight font-bold wrap-anywhere">{game.title}</h2>
                <div
                  className="flex min-h-5 items-center gap-1.5 text-sm text-muted-foreground"
                  role="status"
                >
                  {changing && <Spinner aria-hidden="true" />}
                  {state === 'ready' && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  {gameStatus[state]}
                </div>
                {instance?.error && pendingAction !== 'play' && (
                  <Alert variant="destructive">
                    <AlertDescription className="min-w-0 wrap-anywhere">
                      {instance.error}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  {state === 'ready' && instance && (
                    <Button asChild className="h-11">
                      <a
                        aria-label={`Open stream for ${game.title} (opens in a new tab)`}
                        href={`/viewer/play/?instance=${encodeURIComponent(instance.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open stream
                      </a>
                    </Button>
                  )}
                  {(state === 'idle' || state === 'failed') && (
                    <Button
                      className="h-11"
                      type="button"
                      aria-label={`${playLabel} ${game.title}`}
                      disabled={controlsDisabled}
                      onClick={() => void send(game, { type: 'play' })}
                    >
                      {playLabel}
                    </Button>
                  )}
                  {instance && state !== 'stopping' && (
                    <Button
                      className="h-11"
                      type="button"
                      variant="outline"
                      aria-label={`Stop ${game.title}`}
                      disabled={controlsDisabled}
                      onClick={() => void send(game, { type: 'stop', instanceId: instance.id })}
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
