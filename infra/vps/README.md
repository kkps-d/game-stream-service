# VPS ingress and TURN

This Compose project runs Caddy and coturn on a Linux VPS. Caddy serves the built player panel over HTTPS and forwards `/api` and `/viewer` to the session service on loopback. coturn uses the VPS IPv4 address for TURN over UDP. The game runner and containers stay on the game host.

## Setup

1. Point the player hostname's DNS A record at the VPS public IPv4 address. Allow TCP 80 and 443 for Caddy and UDP 3478 and 49160–49200 for coturn in both the VPS firewall and the provider firewall. If the VPS is behind provider NAT, the TURN ports need the same public and private port numbers.
2. From the repository root, run `npm --prefix game-session-service ci` and `npm --prefix game-session-service run build`. Build the [viewer](../../game-container-runner/README.md#local-streaming-network) too and set up the [session service](../../game-session-service/README.md) on the same VPS.
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

In `game-session-service/.env`, use the following values alongside the existing session and runner settings. Replace the hostname, IP, and path with your own. Start the session service with `npm run start:api` on the VPS.

```dotenv
NODE_ENV=production
API_PORT=3100
APP_ORIGINS=https://play.example.com
GAME_VIEWER_DIR=/absolute/path/to/web-remote-desktop/client/dist/game-stream
TURN_URL=turn:203.0.113.10:3478?transport=udp
TURN_SHARED_SECRET=
```

Start both containers from this directory.

```sh
docker compose up -d
docker compose ps
curl -fsS https://play.example.com/api/health
```

Caddy stores its certificates in the `caddy_data` volume. The runner connects to `wss://play.example.com/api/runners/connect`. The game agent still needs public WSS registration support and outbound access to the VPS for internet playback. [Work in progress](../../WORK.md)
