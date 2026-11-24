# Development

## Backend

The TypeScript source runs directly on Node 24. Drizzle uses the `better-sqlite3` driver with WAL mode. Run `npm run db:push` from `game-session-service/` before starting the API or creating accounts. The command applies the TypeScript schema directly. `DATABASE_PATH` is relative to `game-session-service/` unless it is absolute. To start over with a local database, stop the API, remove the SQLite file and its WAL and SHM sidecars, then run `db:push` and recreate accounts.

Drizzle ORM and Kit use matching pinned versions to keep repeated SQLite schema pushes stable with table constraints.

The auth feature has `types/` for domain types and request DTOs, `services/` for credentials, sessions, and schema, and `controller/` for HTTP and the account CLI.

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

Set `AGENT_BIND_ADDRESS` to the private Docker bridge gateway to enable an additional listener on `API_PORT`. It serves `GET /api/health` and accepts agent WebSocket upgrades at `/api/agents/connect/:instanceId`. Play issues a bearer token for that instance and player. The token expires after two minutes and can register one connection. The service closes the connection when the runner reports the instance stopping, failing, or gone. See the [local startup order](../../game-container-runner/README.md#local-streaming-network).

## Runner connection

Set `RUNNER_ID` and `RUNNER_TOKEN` together to enable WebSocket upgrades at `/api/runners/connect`. The admin-only `GET /api/admin/runner` returns the runner's ID, `online` flag, and latest snapshot. An offline runner has a null snapshot. With runner integration disabled, the endpoint returns `{"runner": null}`.

See the [runner setup](../../game-container-runner/README.md) for local testing.

## Player games

| Method | Path                      | Purpose                                           |
| ------ | ------------------------- | ------------------------------------------------- |
| GET    | `/api/games`              | List games and the caller’s own instances         |
| POST   | `/api/games/:gameId/play` | Start the caller’s OpenArena container            |
| POST   | `/api/games/:gameId/stop` | Stop the instance identified by JSON `instanceId` |

The service derives the runner profile from the signed-in account ID. Play and Stop return `202` when sent. The player panel polls for confirmed state and displays safe launch and stop errors. Docker diagnostics are in the runner logs. Unknown games and stale or foreign instances return `404`. Commands return `503` while the runner is unavailable.

## Game stream API

Set `TURN_URL` and `TURN_SHARED_SECRET` from the local coturn setup. The service issues separate ten-minute credentials for each WebRTC peer. Under `/api/games/instances/:instanceId/stream`, the owner can fetch `GET /ice`, exchange SDP with `POST /offer`, and use the returned session URL for stream settings, stats, and viewer teardown. These requests require a running instance with a registered agent.

## Frontend

The player and admin panels each own a code-based TanStack route tree. `/login` handles sign-in and `/` checks the appropriate session before showing the signed-in page. Vite proxies `/api` so browsers use same-origin cookie requests. Change `PLAYER_PORT` or `ADMIN_PORT` in `.env` to override the local panel ports.

Each panel organizes its pages and supporting code by feature. The `src-shared/` tree holds components, styles, and API functions used by both panels.

The build creates `frontend/src/dist/` and `frontend/src-admin/dist/`, relative to this service. Serve each static bundle with an SPA fallback and a same-origin `/api` route to the backend. For HTTPS deployments, use `NODE_ENV=production`, set `APP_ORIGINS` to the public origins, and have the local reverse proxy set trusted forwarding headers. Production deployment has yet to be configured.

The service manages frontend dependencies through the `frontend/` npm workspace and a single service lockfile. Run shadcn CLI commands from `frontend/`, where `components.json` lives. Use `npx shadcn@latest info --json` to check paths and `npx shadcn@latest add <component> --dry-run` to preview changes. Keep generated components on the shared `@/shared/lib/utils` import for `cn()`.

Shared UI primitives come from the [shadcn/ui registry](https://ui.shadcn.com/docs/components) under its [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
