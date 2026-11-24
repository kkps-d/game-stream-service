import { useState } from 'react';
import { signOut } from '@/features/auth/hooks/session-api';
import { Button } from '@/shared/components/ui/button';

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
    <div className="mt-6 grid gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" type="button" disabled={busy} onClick={submit}>
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
