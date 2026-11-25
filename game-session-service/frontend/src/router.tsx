import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { SessionError } from '@/features/auth/components/session-error';
import { getSession } from '@/features/auth/hooks/session-api';
import { GameCatalog } from './features/games/components/game-catalog';
import { GameApiError } from './features/games/hooks/game-api';
import { getLobbies } from './features/lobbies/hooks/lobby-api';
import { LobbiesPage } from './features/lobbies/layout/lobbies-page';
import { HomePage } from './features/auth/layout/home-page';
import { LoginPage } from './features/auth/layout/login-page';
import { panel } from './shared/lib/panel';

const rootRoute = createRootRoute({ component: Outlet });

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'player',
  beforeLoad: async ({ abortController }) => {
    const user = await getSession(panel);
    if (!user) throw redirect({ to: '/login', replace: true });
    try {
      return { user, lobbyDirectory: await getLobbies(abortController.signal) };
    } catch (error) {
      if (error instanceof GameApiError && error.status === 401)
        throw redirect({ to: '/login', replace: true });
      if (error instanceof GameApiError && error.status === 404)
        return { user, lobbyDirectory: null };
      throw error;
    }
  },
  component: () => {
    const { user, lobbyDirectory } = playerRoute.useRouteContext();
    return (
      <HomePage user={user} showLobbies={!!lobbyDirectory?.enabled} onSignedOut={backToLogin}>
        <Outlet />
      </HomePage>
    );
  },
});

const homeRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/',
  component: () => (
    <>
      <h1 className="text-[clamp(3rem,8vw,5.5rem)] leading-none font-normal tracking-tight">
        Game library
      </h1>
      <GameCatalog key={homeRoute.useRouteContext().user.id} onSessionExpired={backToLogin} />
    </>
  ),
});

const lobbiesRoute = createRoute({
  getParentRoute: () => playerRoute,
  path: '/lobbies',
  beforeLoad: ({ context }) => {
    if (!context.lobbyDirectory?.enabled) throw redirect({ to: '/', replace: true });
    return { directory: context.lobbyDirectory };
  },
  component: () => (
    <LobbiesPage
      initial={lobbiesRoute.useRouteContext().directory}
      onSessionExpired={backToLogin}
    />
  ),
});

async function backToLogin() {
  await router.navigate({ to: '/login', replace: true });
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await getSession(panel)) throw redirect({ to: '/', replace: true });
  },
  component: () => <LoginPage onSignedIn={() => router.navigate({ to: '/', replace: true })} />,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    playerRoute.addChildren([homeRoute, lobbiesRoute]),
    loginRoute,
  ]),
  defaultErrorComponent: SessionError,
});
