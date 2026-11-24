# Game container runner

The runner connects from the game host to the game session service. It runs one container per player per game and reports game state to the session service.

## Setup

Use Node.js 24.2+ in the 24.x series and a native Linux Docker host with the local `containerz/openarena:dev` image. See the [OpenArena build instructions](https://github.com/kkps-d/containerz/tree/main/images/openarena) or use the existing local image. In `game-container-runner/`, run `npm ci` and copy `.env.example` to `.env`. Generate a runner token and copy it to `RUNNER_TOKEN` in both services.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set the same `RUNNER_ID` in both services. Set `RUNNER_GPU_PCI` to the game host GPU's PCI address from `/dev/dri/by-path`, for example `0000:01:00.0`. The runner uses NVIDIA CDI or AMD DRM device mappings. Start the session API, then run `npm start` here. The example WebSocket URL uses the default local API port. Sign in to the player panel and use **Play** or **Stop** on a game card. Sign in to the admin panel and open `/api/admin/runner` on the same origin to read the full snapshot.

A game becomes **Running** when its bundled agent responds inside the container. **Stop** removes the container and keeps its save volume. Each player and game gets a separate volume, including each Minecraft version. Restarting the runner recovers existing games from Docker. New games use the images’ 1280×720 display at 60 fps. The viewer can lower the stream resolution and bitrate.

Minecraft uses the account's login username on first launch if it contains 3–16 ASCII letters, digits, or underscores. Other logins get a stable `P_` name based on the account ID. Existing saves keep their recorded offline name and UUID. The account ID still identifies the owner and keys the save volume.

## Game images

Build the images you plan to run in the `containerz` checkout. The runner uses local tags.

| Game              | Image                          | Save directory                         |
| ----------------- | ------------------------------ | -------------------------------------- |
| OpenArena         | `containerz/openarena:dev`     | `/home/player/.openarena`              |
| Minecraft 26.3    | `containerz/minecraft:26.3`    | `/home/player/.local/share/PineconeMC` |
| Minecraft 1.21.11 | `containerz/minecraft:1.21.11` | `/home/player/.local/share/PineconeMC` |
| HoloCure          | `containerz/holocure:dev`      | `/home/player/.wine-holocure`          |

Set `HOLOCURE_GAME_DIR` in the runner's `.env` to the local extracted game directory containing `HoloCure.exe` and `data.win`. The runner mounts it read-only at `/opt/holocure`. [HoloCure setup](https://github.com/kkps-d/containerz/tree/main/images/holocure)

## Local streaming network

Rebuild the streamer and game images from the updated web-remote-desktop agent. Run these commands from the `containerz` checkout with `web-remote-desktop` next to it.

```sh
docker build --build-context streamer=../web-remote-desktop/agent -t containerz/streamer:dev images/streamer
docker build -t containerz/openarena:dev images/openarena
docker build -t containerz/minecraft:26.3 images/minecraft
docker build -t containerz/minecraft:1.21.11 --build-arg MINECRAFT_VERSION=1.21.11 images/minecraft
docker build -t containerz/holocure:dev images/holocure
npm --prefix ../web-remote-desktop/client ci
npm --prefix ../web-remote-desktop/client run build -- --base /viewer/ --outDir dist/game-stream
```

1. Start [coturn](../infra/coturn/README.md) to create the internal bridge.
2. Set the session service's `.env` using the values below. Use the `static-auth-secret` from coturn's ignored local config for `TURN_SHARED_SECRET`.
3. Set `RUNNER_DOCKER_NETWORK=game-stream-coturn_relay` in the runner's `.env`. Start the session API, then the runner and player panel. Restart the API and runner together when upgrading the protocol.
4. Sign in, select **Play**, and open **Open stream** once it appears. Click the video to capture the mouse and enable sound. Use **Stop** in the player tab to end the game before taking down coturn.

```dotenv
AGENT_BIND_ADDRESS=172.30.42.1
TURN_URL=turn:172.30.42.2:3478?transport=udp
TURN_SHARED_SECRET=
GAME_VIEWER_DIR=../../web-remote-desktop/client/dist/game-stream
```

If you changed the coturn subnet or project name, use the actual bridge gateway, coturn IP, and network name. Restart the runner if you recreate the bridge. Leave `RUNNER_DOCKER_NETWORK` unset for the existing `--network none` mode.

The API logs the registered instance ID. Stop and relaunch the game to register again after an agent disconnect or API restart.

## Development

Run `npm run lint`, `npm run check`, and `npm test`. Use `npm run dev` for file watching and `npm run format` after editing. See the [runner protocol](docs/protocol.md) for connection and status behavior.
