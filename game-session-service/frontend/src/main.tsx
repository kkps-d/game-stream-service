import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountPanel } from '@/account-panel';
import { getSession } from '@/session-api';
import '@/styles.css';

const rootRoute = createRootRoute({ component: Outlet });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: () => getSession('user'),
  component: () => <AccountPanel panel="user" user={indexRoute.useLoaderData()} />,
});
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
