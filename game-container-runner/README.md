# Game container runner

The runner connects from the game host to the game session service. It runs one OpenArena container per player and reports game state to the session service.

## Setup

Use Node.js 24.2+ in the 24.x series and a native Linux Docker host with the local `containerz/openarena:dev` image. See the [OpenArena build instructions](https://github.com/kkps-d/containerz/tree/main/images/openarena) or use the existing local image. In `game-container-runner/`, run `npm ci` and copy `.env.example` to `.env`. Generate a runner token and copy it to `RUNNER_TOKEN` in both services.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set the same `RUNNER_ID` in both services. Set `RUNNER_GPU_PCI` to the game host GPU's PCI address from `/dev/dri/by-path`, for example `0000:01:00.0`. The runner uses NVIDIA CDI or AMD DRM device mappings. Start the session API, then run `npm start` here. The example WebSocket URL uses the default local API port. Sign in to the player panel and use **Play** or **Stop** on OpenArena. Sign in to the admin panel and open `/api/admin/runner` on the same origin to read the full snapshot.

OpenArena becomes **Running** when the bundled agent responds inside the container. **Stop** removes the container while keeping the player's named save volume at `/home/player/.openarena`. Restarting the runner recovers existing games from Docker.

## Local streaming network

1. Start [coturn](../infra/coturn/README.md) to create the internal bridge.
2. Set `AGENT_BIND_ADDRESS=172.30.42.1` in the session service's `.env` and start the API. If you changed the coturn subnet, use the gateway shown by `docker network inspect game-stream-coturn_relay`.
3. Set `RUNNER_DOCKER_NETWORK=game-stream-coturn_relay` in the runner's `.env` and start the runner. Use the project's actual network name if you customized the Compose project name.
4. Start the player panel and select **Play**. Use **Stop** before taking down the coturn stack.

The runner checks the internal bridge at startup. Restart it if you recreate the bridge. Leave `RUNNER_DOCKER_NETWORK` unset to launch games with `--network none`. OpenArena's agent continues to listen on loopback inside the container.

## Development

Run `npm run lint`, `npm run check`, and `npm test`. Use `npm run dev` for file watching and `npm run format` after editing. See the [runner protocol](docs/protocol.md) for connection and status behavior.
