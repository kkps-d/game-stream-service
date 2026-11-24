import { Button } from '@/shared/components/ui/button';
import { AuthCard } from './auth-card';

export function SessionError() {
  return (
    <AuthCard title="Could not check your session">
      <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </AuthCard>
  );
}
