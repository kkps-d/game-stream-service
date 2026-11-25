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

## Features and known issues

- Username/password sign-in, Drizzle-backed SQLite sessions, and server-side admin access checks.
- The player panel launches and streams OpenArena, Minecraft 26.3, Minecraft 1.21.11, and HoloCure through the [game container runner](../game-container-runner/README.md).
- Account creation is an operator command.

## Layout

- `backend/` contains the Express API and feature code for accounts and sessions.
- `frontend/src/` is the player panel. `frontend/src-admin/` is the admin panel.
- `frontend/src-shared/` contains the UI primitives, styles, and session client used by both panels.

See the [development guide](docs/development.md) for API and build details.
