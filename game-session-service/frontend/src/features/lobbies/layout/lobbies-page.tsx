import { useEffect, useState, type FormEvent } from 'react';
import type { LobbyDirectory, LobbySummary } from '../../../../../../protocol/lobbies.ts';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { GameApiError } from '../../games/hooks/game-api';
import { getLobbies, sendLobbyAction, type LobbyAction } from '../hooks/lobby-api';

export function LobbiesPage({
  initial,
  onSessionExpired,
}: {
  initial: LobbyDirectory;
  onSessionExpired: () => Promise<void>;
}) {
  const [directory, setDirectory] = useState(initial);
  const [query, setQuery] = useState('');
  const [joining, setJoining] = useState<LobbySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await getLobbies(controller.signal);
        if (!controller.signal.aborted) {
          setDirectory(next);
          setRefreshFailed(false);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof GameApiError && error.status === 401) {
          await onSessionExpired();
          return;
        }
        setRefreshFailed(true);
      }
      timer = setTimeout(() => void refresh(), 1_500);
    }
    timer = setTimeout(() => void refresh(), 1_500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [onSessionExpired]);

  async function submit(action: LobbyAction) {
    setBusy(true);
    setMessage('');
    try {
      await sendLobbyAction(action);
      setJoining(null);
      setDirectory(await getLobbies());
    } catch (error) {
      if (error instanceof GameApiError && error.status === 401) {
        await onSessionExpired();
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not update the lobby.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage('Lobby code copied.');
    } catch {
      setMessage('Could not copy the code. You can select it from the lobby card.');
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void submit({
      type: 'create',
      name: String(data.get('name')),
      password: String(data.get('password')),
    });
  }

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joining) return;
    const data = new FormData(event.currentTarget);
    void submit({ type: 'join', code: joining.code, password: String(data.get('password')) });
  }

  const search = query.trim().toLowerCase();
  const results = directory.lobbies.filter(
    ({ name, code }) => name.toLowerCase().includes(search) || code.toLowerCase() === search,
  );
  const current = directory.membership;
  const canJoin = directory.runnerOnline && !current && !busy;

  return (
    <>
      <h1 className="text-[clamp(3rem,8vw,5.5rem)] leading-none font-normal tracking-tight">
        Lobbies
      </h1>
      {message && (
        <Alert role="status">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {refreshFailed && (
        <Alert>
          <AlertDescription>Could not refresh lobbies. Retrying…</AlertDescription>
        </Alert>
      )}
      {!directory.runnerOnline && (
        <Alert>
          <AlertDescription>The lobby runner is offline.</AlertDescription>
        </Alert>
      )}
      {current ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{current.name}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <code>{current.code}</code>
              <Button variant="outline" size="sm" onClick={() => void copyCode(current.code)}>
                Copy code
              </Button>
            </div>
            <p role="status">
              {current.state === 'leaving'
                ? 'Leaving lobby. Your stream can stay open.'
                : current.state === 'preparing'
                  ? 'Preparing the lobby network…'
                  : 'New games you start will join this lobby. Relaunch any game already running.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Members · {current.members.join(', ') || 'None'}
            </p>
            <Button
              className="self-start"
              variant="outline"
              disabled={busy || current.state === 'leaving'}
              onClick={() => void submit({ type: 'leave' })}
            >
              Leave lobby
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Create a lobby</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="lobby-name">Name</FieldLabel>
                  <Input id="lobby-name" name="name" required maxLength={60} disabled={!canJoin} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-password">Password (optional)</FieldLabel>
                  <Input
                    id="create-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    disabled={!canJoin}
                  />
                </Field>
                <Button type="submit" className="self-start" disabled={!canJoin}>
                  Create lobby
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Find a lobby</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="lobby-search">Search by name or code</FieldLabel>
            <Input
              id="lobby-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={80}
            />
          </Field>
          {results.length ? (
            <ul className="grid gap-3">
              {results.map((lobby) => (
                <li key={lobby.id} className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium wrap-anywhere">{lobby.name}</div>
                      <div className="text-sm text-muted-foreground">
                        <code>{lobby.code}</code> · {lobby.memberCount}{' '}
                        {lobby.memberCount === 1 ? 'member' : 'members'}
                        {lobby.passwordRequired && ' · Password required'}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!canJoin}
                      aria-label={`Join ${lobby.name}`}
                      onClick={() => {
                        setMessage('');
                        setJoining(null);
                        if (lobby.passwordRequired) setJoining(lobby);
                        else void submit({ type: 'join', code: lobby.code, password: '' });
                      }}
                    >
                      Join
                    </Button>
                  </div>
                  {joining?.id === lobby.id && canJoin && (
                    <form onSubmit={join}>
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor="join-password">Lobby password</FieldLabel>
                          <Input
                            id="join-password"
                            name="password"
                            type="password"
                            autoComplete="off"
                            maxLength={128}
                            required
                          />
                        </Field>
                        <div className="flex gap-2">
                          <Button type="submit">Join lobby</Button>
                          <Button type="button" variant="outline" onClick={() => setJoining(null)}>
                            Cancel
                          </Button>
                        </div>
                      </FieldGroup>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {search ? 'No matching lobbies.' : 'No lobbies yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
