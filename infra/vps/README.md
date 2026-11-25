# VPS ingress and TURN

This Compose project runs Caddy and coturn on a Linux VPS. Caddy serves the built player panel over HTTPS and forwards `/api` and `/viewer` to the session service on loopback. Agent WebSockets use a dedicated loopback listener. coturn uses the VPS IPv4 address for TURN over UDP. The game runner and containers stay on the game host.

## Setup

1. Point the player hostname's DNS A record at the VPS public IPv4 address. Allow TCP 80 and 443 for Caddy and UDP 3478 and 49160–49200 for coturn in both the VPS firewall and the provider firewall. If the VPS is behind provider NAT, the TURN ports need the same public and private port numbers.
2. Build the player panel and [viewer](../../game-container-runner/README.md#local-streaming-network) on the game host. Copy the committed release and both builds to the VPS. Run `npm --prefix game-session-service ci` on the VPS to install dependencies for its Node runtime.
3. In this directory, copy `.env.example` to `.env`. Set `SITE_DOMAIN` to the player hostname and `API_PORT` to the session service port. Set `TURN_LISTEN_IP` to the VPS interface IPv4 and `TURN_PUBLIC_IP` to its public IPv4. Use the same address for both on a VPS with public IPv4 assigned directly.
4. Generate the TURN secret once from this directory. Use the same secret in the session service's `TURN_SHARED_SECRET`.

```sh
install -d -m 700 local
(
  set -C
  umask 022
  { cat turnserver.conf.example; printf 'static-auth-secret=%s\n' "$(openssl rand -hex 32)"; } > local/turnserver.conf
)
```

In the session service environment, use the following values alongside the existing session and runner settings. Replace the hostname, IP, and path with your own. Set `DATABASE_PATH=/var/lib/game-stream-service/game-session.sqlite` and initialize the schema with `npm run db:push` as the service user. Create fresh test accounts on the VPS.

Use [game-session.service](game-session.service) with Node.js 24 at `/opt/node24`, the release at `/opt/game-stream-service/current`, and the runtime settings in `/etc/game-stream-service/session.env`. Create the `game-stream` system user and make the database directory writable by that user. Start the service with `systemctl enable --now game-session`.

```dotenv
NODE_ENV=production
API_PORT=3100
AGENT_API_PORT=3101
AGENT_PUBLIC_ORIGIN=wss://play.example.com
APP_ORIGINS=https://play.example.com
GAME_VIEWER_DIR=/opt/game-stream-service/current/viewer
TURN_URL=turn:203.0.113.10:3478?transport=udp
TURN_SHARED_SECRET=
```

Start both containers from this directory.

```sh
docker compose up -d
docker compose ps
curl -fsS https://play.example.com/api/health
```

Caddy stores its certificates in the `caddy_data` volume. The runner connects to `wss://play.example.com/api/runners/connect`. The server advertises WSS agent registration on the same hostname.

## Game host

Rebuild the streamer and every game image in the player catalog when the agent changes. Each game image bundles its own copy of the agent. Use the [game image build commands](../../game-container-runner/README.md#local-streaming-network). Start new game containers to pick up the rebuilt images.

Apply the firewall before creating the dedicated bridge or starting the VPS runner. Substitute the public VPS IPv4 below.

```sh
{ printf 'define vps_ip = 203.0.113.10\n'; cat game-bridge.nft; } | sudo nft -f -
docker network create --driver bridge --subnet 172.30.44.0/24 \
  --opt com.docker.network.bridge.name=br-game-vps \
  --opt com.docker.network.bridge.enable_icc=false game-stream-vps-egress
```

Use `RUNNER_ID=vps-test` on both hosts. On the game host, set `RUNNER_WS_URL=wss://play.example.com/api/runners/connect`, `RUNNER_DOCKER_NETWORK=game-stream-vps-egress`, and `RUNNER_VPS_IP` to the public VPS IPv4. Match `RUNNER_TOKEN` with the session service. Reapply the firewall after reboot before starting the VPS runner.

## Enable LAN lobbies

Run the API schema update from the new release. Set `ENABLE_LAN_LOBBIES=1` in
the VPS session environment and `RUNNER_ENABLE_LAN_LOBBIES=1` in the game host
runner environment. On the game host, build the helper before restarting the
runner and API.

```sh
docker build -t game-stream/lobby-network:dev infra/lobbies
```

The runner keeps WSS and TURN on the existing VPS egress bridge. Each lobby
uses a separate Docker bridge with no host gateway or NAT. Use the standard
WSS and TURN ports from the firewall setup above.

## Stop the test

Stop any games from the player panel, stop the VPS runner on the game host, then run `systemctl stop game-session` and `docker compose stop` on the VPS. Keep the SQLite file, Caddy volumes, and game save volumes for the next run.
