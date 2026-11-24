import { useState } from 'react';
import { signOut } from '@/features/auth/hooks/session-api';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/ui/spinner';

export function SignOutButton({
  compact = false,
  onSignedOut,
}: {
  compact?: boolean;
  onSignedOut: () => Promise<void>;
}) {
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
    <div className={compact ? 'grid min-w-0 justify-items-end gap-2' : 'grid w-full gap-4'}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="min-w-0 wrap-anywhere">{error}</AlertDescription>
        </Alert>
      )}
      <Button
        variant={compact ? 'ghost' : 'default'}
        className={compact ? undefined : 'w-full'}
        type="button"
        disabled={busy}
        onClick={submit}
      >
        {busy && <Spinner aria-hidden="true" data-icon="inline-start" />}
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
