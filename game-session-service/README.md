# Game session service

The API owns user accounts and sessions. Two independent frontends provide player and admin sign-in.

## Setup

Use Node.js 24.2+ in the 24.x series. From `game-session-service/`:

```sh
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `SESSION_SECRET` in `.env`. Initialize the database, create accounts, and start the API:

```sh
npm run db:push
npm run account:create -- player
npm run account:create -- operator admin
npm run dev:api
```

To change an existing account's password, run `npm run account:password -- player`.
Both commands prompt for a password when you omit it. Passwords must be 12–128
characters. For noninteractive use, pass the password as the final argument.
Include the role when creating an account this way.

```sh
npm run --silent account:create -- player user '<password>'
npm run --silent account:password -- player '<new-password>'
```

Use the masked prompts to keep passwords out of shell history.

Run either or both panels in separate terminals.

| Command                 | Panel  | Address                 |
| ----------------------- | ------ | ----------------------- |
| `npm run dev`           | Player | <http://localhost:5180> |
| `npm run dev src-admin` | Admin  | <http://localhost:5181> |

Run `npm run build` to type-check and build both panels, `npm test` for API tests, and `npm run lint` for lint checks. Run `npm run format` after editing.

## Test LAN lobbies locally

Use the [local streaming setup](../game-container-runner/README.md#local-streaming-network)
with native Linux, Docker Engine 28 or later, and local coturn. From the repository
root, build the network helper and update the local database.

```sh
docker build -t game-stream/lobby-network:dev infra/lobbies
npm --prefix game-session-service run db:push
```

Set `ENABLE_LAN_LOBBIES=1` in `game-session-service/.env` and
`RUNNER_ENABLE_LAN_LOBBIES=1` in `game-container-runner/.env`. If you changed
the local coturn address or listening port, set `RUNNER_LOBBY_TURN_IP` or
`RUNNER_LOBBY_TURN_PORT` to match `TURN_URL`. Start the following from the root
in separate terminals after coturn is running.

```sh
npm --prefix game-session-service run dev:api
npm --prefix game-container-runner start
npm --prefix game-session-service run dev
```

Create two player accounts and open <http://localhost:5180> in two browser profiles.

1. In **Lobbies**, create a room with a password. From the second account, find
   it by name or code and join with the password.
2. In **Games**, both players start Minecraft 26.3 and open their streams.
   Relaunch any game that was already running before joining.
3. In the first Minecraft session, open a singleplayer world and set
   **World Options → Multiplayer → LAN** to **On**. Apply changes. In the
   second session, join the world from **Multiplayer**.
4. Leave the lobby from the first account with its stream still open. The other
   player stays in the lobby and can host a new world. When everyone leaves,
   the lobby remains available for five minutes.

Each lobby has a Docker bridge without a host gateway address or NAT. Docker's
internal bridge mode drops LAN multicast on hosts with bridge netfilter enabled.
The runner's one-shot helper removes the lobby's default route and restricts
both interfaces before the unprivileged game starts. When done testing, leave any lobbies and let them
expire before turning the feature off.

## Features and known issues

- Username/password sign-in, Drizzle-backed SQLite sessions, and server-side admin access checks.
- The player panel launches and streams OpenArena, Minecraft 26.3, Minecraft 1.21.11, and HoloCure through the [game container runner](../game-container-runner/README.md).
- Account creation is an operator command.

## Layout

- `backend/` contains the Express API and feature code for accounts and sessions.
- `frontend/src/` is the player panel. `frontend/src-admin/` is the admin panel.
- `frontend/src-shared/` contains the UI primitives, styles, and session client used by both panels.

See the [development guide](docs/development.md) for API and build details.
