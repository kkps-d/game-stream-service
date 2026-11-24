import { Box, Crosshair, Gamepad2, Heart, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Empty, EmptyHeader, EmptyTitle } from '@/shared/components/ui/empty';
import { Spinner } from '@/shared/components/ui/spinner';
import { useGameCatalog } from '../hooks/use-game-catalog';

const gameIcons: ReadonlyMap<string, LucideIcon> = new Map([
  ['openarena', Crosshair],
  ['minecraft', Box],
  ['minecraft-1-21-11', Box],
  ['holocure', Heart],
]);

const labels = {
  idle: 'Idle',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  failed: 'Failed',
};

export function GameCatalog({ onSessionExpired }: { onSessionExpired: () => Promise<void> }) {
  const { catalog, pending, error, refreshFailed, send } = useGameCatalog(onSessionExpired);
  const controlsDisabled = !!pending || refreshFailed || !catalog?.runnerOnline;

  return (
    <section className="grid gap-3" aria-label="Games">
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
          <AlertDescription>Game runner offline.</AlertDescription>
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
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {catalog?.games.map((game) => {
        const Icon = gameIcons.get(game.id) ?? Gamepad2;
        const instance = game.instance;
        const pendingAction = pending?.gameId === game.id ? pending.action.type : null;
        return (
          <article key={game.id}>
            <Card>
              <CardHeader className="flex flex-row items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <CardTitle>
                    <h2>{game.title}</h2>
                  </CardTitle>
                  <CardDescription role="status">
                    {labels[instance?.state ?? 'idle']}
                  </CardDescription>
                </div>
              </CardHeader>
              {instance?.error && (
                <CardContent>
                  <Alert variant="destructive">
                    <AlertDescription>{instance.error}</AlertDescription>
                  </Alert>
                </CardContent>
              )}
              <CardFooter className="flex-wrap gap-2">
                {instance?.streamReady && (
                  <Button asChild>
                    <a
                      href={`/viewer/play/?instance=${encodeURIComponent(instance.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open stream
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  aria-label={`Play ${game.title}`}
                  disabled={controlsDisabled || (instance !== null && instance.state !== 'failed')}
                  onClick={() => void send(game, { type: 'play' })}
                >
                  {pendingAction === 'play' && (
                    <Spinner aria-hidden="true" data-icon="inline-start" />
                  )}
                  Play
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Stop ${game.title}`}
                  disabled={controlsDisabled || !instance || instance.state === 'stopping'}
                  onClick={() => {
                    if (instance) void send(game, { type: 'stop', instanceId: instance.id });
                  }}
                >
                  {pendingAction === 'stop' && (
                    <Spinner aria-hidden="true" data-icon="inline-start" />
                  )}
                  Stop
                </Button>
              </CardFooter>
            </Card>
          </article>
        );
      })}
    </section>
  );
}
