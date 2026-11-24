import { Button } from '@/shared/components/ui/button';
import { AuthCard } from './auth-card';

export function SessionError() {
  return (
    <AuthCard
      title="Could not check your session"
      footer={
        <Button className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      }
    />
  );
}
