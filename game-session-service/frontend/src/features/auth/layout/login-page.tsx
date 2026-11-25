import { LoginForm } from '@/features/auth/components/login-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PlayerBrand } from '../../../shared/components/player-brand';
import { panel } from '../../../shared/lib/panel';

export function LoginPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  return (
    <main className="player-theme grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground sm:px-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-4">
          <PlayerBrand />
          <CardTitle>
            <h1 className="text-5xl leading-none font-normal tracking-tight sm:text-6xl">
              Sign in
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm panel={panel} onSignedIn={onSignedIn} />
        </CardContent>
      </Card>
    </main>
  );
}
