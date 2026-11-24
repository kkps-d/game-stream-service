import { Button } from '@/shared/components/ui/button';
import { useGameCatalog } from '../hooks/use-game-catalog';

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
    <section className="mt-6" aria-label="Games">
      {refreshFailed ? (
        <p role="status" className="text-sm text-muted-foreground">
          Could not refresh games. Retrying…
        </p>
      ) : !catalog ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading games…
        </p>
      ) : !catalog.runnerOnline ? (
        <p role="status" className="text-sm text-muted-foreground">
          Game runner offline.
        </p>
      ) : catalog.games.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games available.</p>
      ) : null}
      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {catalog?.games.map((game) => {
        const instance = game.instance;
        return (
          <article key={game.id} className="rounded-lg border border-slate-200 p-4">
            <h2 className="font-medium">{game.title}</h2>
            <p role="status" className="mt-1 text-sm text-muted-foreground">
              {labels[instance?.state ?? 'idle']}
              {instance?.error && <span className="block text-destructive">{instance.error}</span>}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                disabled={controlsDisabled || (instance !== null && instance.state !== 'failed')}
                onClick={() => void send(game, { type: 'play' })}
              >
                Play
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={controlsDisabled || !instance || instance.state === 'stopping'}
                onClick={() => {
                  if (instance) void send(game, { type: 'stop', instanceId: instance.id });
                }}
              >
                Stop
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
