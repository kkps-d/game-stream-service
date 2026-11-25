# Runner protocol

The runner connects to `/api/runners/connect` with its token in an `Authorization: Bearer` header. Use a loopback `ws://` URL for local development and a `wss://` URL for remote deployments. The session service accepts one active connection for its configured runner.

Protocol version 4 uses JSON in both directions. The service sends `play` and `stop` commands with a profile, game, and instance ID. The session service assigns the instance ID on Play. On the private bridge, Play also carries the agent registration URL and a one-time token. The runner passes these into the new container and keeps the token out of its snapshots and Docker command arguments. The runner publishes a full `snapshot` on connect and after each state change. The snapshot contains the catalog and profile-owned instances in `starting`, `running`, `stopping`, or `failed` state. An instance can include a short error message. The service validates and filters the snapshot before serving player requests.

Minecraft Play commands can include `username`, the authenticated account's stored lowercase login. The runner uses the account-based fallback if an older service omits it or if the login is incompatible with Minecraft. The `profileId` still comes from the stable account ID and identifies ownership and saves.

Shared TypeScript types live in [the repository protocol directory](../../protocol/runner.ts). Upgrade the API and runner together when switching to v4.

The runner is online once a snapshot is accepted. Disconnecting clears the snapshot. WebSocket ping and pong frames detect dead connections. The runner retries transient failures with delays from 1 to 30 seconds and exits when its credentials are rejected.

Docker labels identify the runner, player profile, game, and instance. The runner recovers live instances by inspecting its own containers, then publishes the recovered snapshot. Readiness uses the bundled agent on the container’s loopback address and times out after 20 seconds. If Docker is unavailable, the runner disconnects until it can read the inventory again.

Duplicate Play uses the current instance. A retry after failure creates a new instance with the same save volume. Stop cancels a pending launch or removes the identified container and leaves its volume available for the next Play.

A normal in-game quit returns the game to idle and removes its container while preserving the save volume. A crash reports a failed instance.

## Local LAN lobbies

A runner with lobby networking enabled includes a `lobbies` status in its v4
snapshot. The service sends `lobby-sync` with the desired lobby IDs and member
profiles. The runner acknowledges the sync ID after it reconciles its labeled
bridges and detaches containers whose owners have left. A Play command carries
a `lobbyId` only when the account has an active membership on that runner.
