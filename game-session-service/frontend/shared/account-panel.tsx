import { useRouter } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn, signOut, type SessionUser } from '@/session-api';

interface AccountPanelProps {
  panel: 'user' | 'admin';
  user: SessionUser | null;
}

export function AccountPanel({ panel, user }: AccountPanelProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = panel === 'admin' ? 'Game streaming admin' : 'Game streaming';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (user) {
        await signOut();
      } else {
        const form = new FormData(event.currentTarget);
        await signIn(panel, String(form.get('username')), String(form.get('password')));
      }
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user
            ? `Signed in as ${user.username}.`
            : panel === 'admin'
              ? 'Sign in with an administrator account.'
              : 'Sign in to your account.'}
        </p>
        <form className="mt-6 grid gap-4" onSubmit={submit} key={user?.id ?? 'sign-in'}>
          {!user && (
            <>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="username">
                  Username
                </label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  maxLength={32}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={busy}>
            {user ? (busy ? 'Signing out…' : 'Sign out') : busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  );
}
