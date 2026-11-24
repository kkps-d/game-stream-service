# Local coturn

Runs an authenticated TURN relay for WebRTC development on native Linux with Docker Compose. The host and test container reach it over an internal Docker bridge. No ports are published.

## Start the relay

From this directory, generate the local config once. The private directory protects the shared secret on the host and lets the unprivileged coturn container read the mounted file.

```sh
install -d -m 700 local
(
  set -C
  umask 022
  secret=$(openssl rand -hex 32) || exit
  { cat turnserver.conf.example; printf 'static-auth-secret=%s\n' "$secret"; } > local/turnserver.conf
)
docker compose config --quiet
bash start.sh
```

The startup script adds a return route inside coturn for the host’s primary IPv4 address. Firefox can send UDP from that address even when the panel is on localhost. If Firefox uses another interface, pass its local IPv4 address to `bash start.sh`. Run the script again after restarting coturn to restore the route.

The TURN URL is `turn:172.30.42.2:3478?transport=udp`. The UDP relay ports are `49160–49200`. If the subnet overlaps a host or Docker route, set `TURN_SUBNET`, `TURN_IP`, and `SMOKE_PEER_IP` in a local `.env`. Use distinct addresses in the new subnet for coturn and the test peer.

Run `docker compose down` to stop the relay and remove its network. See the [Chromium smoke test](docs/smoke-test.md) to verify relay traffic and authentication.
