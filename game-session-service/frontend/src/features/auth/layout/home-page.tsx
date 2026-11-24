import { AuthCard } from '@/features/auth/components/auth-card';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import type { SessionUser } from '@/features/auth/hooks/session-api';
import { panelTitle } from '../../../shared/lib/panel';

export function HomePage({
  user,
  onSignedOut,
}: {
  user: SessionUser;
  onSignedOut: () => Promise<void>;
}) {
  return (
    <AuthCard title={panelTitle}>
      <p className="mt-2 text-sm text-muted-foreground">Signed in as {user.username}.</p>
      <SignOutButton onSignedOut={onSignedOut} />
    </AuthCard>
  );
}
