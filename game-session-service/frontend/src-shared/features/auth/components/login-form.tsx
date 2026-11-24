import { useState, type FormEvent } from 'react';
import { signIn, type Panel } from '@/features/auth/hooks/session-api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export function LoginForm({
  panel,
  onSignedIn,
}: {
  panel: Panel;
  onSignedIn: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const form = new FormData(event.currentTarget);
      await signIn(panel, String(form.get('username')), String(form.get('password')));
      await onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={submit}>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="username">
          Username
        </label>
        <Input id="username" name="username" autoComplete="username" maxLength={32} required />
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
