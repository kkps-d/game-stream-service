# Development

## Backend

The TypeScript source runs directly on Node 24. The service creates the SQLite database on first use. `DATABASE_PATH` is relative to `game-session-service/` unless it is absolute.

Passport Local verifies username/password credentials against Argon2id hashes. Express uses an HTTP-only, SameSite cookie for sessions stored in SQLite. The backend checks the current account role for admin access, rate-limits sign-in, and checks `APP_ORIGINS` for requests that change state.

| Method | Path                 | Purpose                                        |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/api/health`        | Check whether the API is running               |
| POST   | `/api/sign-in`       | Sign in with `username` and `password` as JSON |
| GET    | `/api/session`       | Get the signed-in account                      |
| POST   | `/api/admin/sign-in` | Sign in as an administrator                    |
| GET    | `/api/admin/session` | Get the signed-in administrator                |
| POST   | `/api/sign-out`      | Destroy the session                            |

The API binds to `127.0.0.1:3100` by default. Set `API_PORT` in `.env` to change the port for the API and both Vite proxies. Run `npm run start:api` to start without file watching.

## Frontend

Each panel has its own HTML entry point and TanStack Router. Vite proxies `/api` so browsers use same-origin cookie requests. Signing in or out reloads the active session through the router. Change `PLAYER_PORT` or `ADMIN_PORT` in `.env` to override the local panel ports.

The build creates `frontend/src/dist/` and `frontend/src-admin/dist/`, relative to this service. Serve each static bundle with an SPA fallback and a same-origin `/api` route to the backend. For HTTPS deployments, use `NODE_ENV=production`, set `APP_ORIGINS` to the public origins, and have the local reverse proxy set trusted forwarding headers. Production deployment has yet to be configured.

Shared Button and Input source comes from the [shadcn/ui registry](https://ui.shadcn.com/docs/components) under its [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
