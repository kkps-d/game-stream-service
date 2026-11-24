import { AuthCard } from '@/features/auth/components/auth-card';
import { LoginForm } from '@/features/auth/components/login-form';
import { panel, panelTitle } from '../../../shared/lib/panel';

export function LoginPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  return (
    <AuthCard title={panelTitle}>
      <p className="mt-2 text-sm text-muted-foreground">Sign in with an administrator account.</p>
      <LoginForm panel={panel} onSignedIn={onSignedIn} />
    </AuthCard>
  );
}
