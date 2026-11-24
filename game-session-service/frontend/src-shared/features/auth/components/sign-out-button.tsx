import { useState } from 'react';
import { signOut } from '@/features/auth/hooks/session-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';

export function SignOutButton({ onSignedOut }: { onSignedOut: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');

    try {
      await signOut();
      await onSignedOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid w-full gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button className="w-full" type="button" disabled={busy} onClick={submit}>
        {busy && <Spinner aria-hidden="true" data-icon="inline-start" />}
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
