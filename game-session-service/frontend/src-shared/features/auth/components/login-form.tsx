import { useState, type FormEvent } from 'react';
import { signIn, type Panel } from '@/features/auth/hooks/session-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Spinner } from '@/shared/components/ui/spinner';

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
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" name="username" autoComplete="username" maxLength={32} required />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button className="w-full" type="submit" disabled={busy}>
        {busy && <Spinner aria-hidden="true" data-icon="inline-start" />}
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
