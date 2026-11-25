import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import type { SessionUser } from '@/features/auth/hooks/session-api';
import { PlayerBrand } from '../../../shared/components/player-brand';

export function HomePage({
  user,
  onSignedOut,
  children,
  showLobbies,
}: {
  user: SessionUser;
  onSignedOut: () => Promise<void>;
  children: ReactNode;
  showLobbies: boolean;
}) {
  return (
    <div className="player-theme min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-10">
          <PlayerBrand />
          <div className="flex min-w-0 max-w-full items-baseline gap-3">
            <span className="min-w-0 text-sm wrap-anywhere text-muted-foreground">
              {user.username}
            </span>
            <SignOutButton compact onSignedOut={onSignedOut} />
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 pt-4 pb-10 sm:gap-5 sm:px-10">
        {showLobbies && (
          <nav className="flex gap-4 border-b" aria-label="Player panel">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="px-1 pb-2 text-sm [&[aria-current]]:border-b-2 [&[aria-current]]:border-primary"
            >
              Games
            </Link>
            <Link
              to="/lobbies"
              className="px-1 pb-2 text-sm [&[aria-current]]:border-b-2 [&[aria-current]]:border-primary"
            >
              Lobbies
            </Link>
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
