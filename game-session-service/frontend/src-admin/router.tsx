import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { SessionError } from '@/features/auth/components/session-error';
import { getSession } from '@/features/auth/hooks/session-api';
import { HomePage } from './features/auth/layout/home-page';
import { LoginPage } from './features/auth/layout/login-page';
import { panel } from './shared/lib/panel';

const rootRoute = createRootRoute({ component: Outlet });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const user = await getSession(panel);
    if (!user) throw redirect({ to: '/login', replace: true });
    return { user };
  },
  component: () => (
    <HomePage
      user={homeRoute.useRouteContext().user}
      onSignedOut={() => router.navigate({ to: '/login', replace: true })}
    />
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await getSession(panel)) throw redirect({ to: '/', replace: true });
  },
  component: () => <LoginPage onSignedIn={() => router.navigate({ to: '/', replace: true })} />,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, loginRoute]),
  defaultErrorComponent: SessionError,
});
