# Game container runner

The runner connects from the game host to the game session service. It reports an OpenArena catalog entry and an empty container list using a local fixture. This milestone can run without Docker.

## Setup

Use Node.js 24.2+ in the 24.x series. In `game-container-runner/`, run `npm ci` and copy `.env.example` to `.env`. Generate a runner token and copy it to `RUNNER_TOKEN` in both services.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `RUNNER_ID=local` in the session service's `.env` and start its API. Then run `npm start` here. The example WebSocket URL uses the default local API port. Sign in to the admin panel and open `/api/admin/runner` on the same origin to read the current snapshot.

## Development

Run `npm run lint`, `npm run check`, and `npm test`. Use `npm run dev` for file watching and `npm run format` after editing. See the [runner protocol](docs/protocol.md) for connection and status behavior.
