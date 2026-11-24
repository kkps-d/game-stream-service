# Runner protocol

The runner connects to `/api/runners/connect` with its token in an `Authorization: Bearer` header. Use a loopback `ws://` URL for local development and a `wss://` URL for remote deployments. The session service accepts one active connection for its configured runner.

Protocol version 3 uses JSON in both directions. The service sends `play` and `stop` commands with a profile ID and game ID. Stop also includes the exact instance ID. The runner publishes a full `snapshot` on connect and after each state change. The snapshot contains the catalog and profile-owned instances in `starting`, `running`, `stopping`, or `failed` state. An instance can include a short error message. The service validates and filters the snapshot before serving player requests.

Shared TypeScript types live in [the repository protocol directory](../../protocol/runner.ts). Upgrade the API and runner together when switching to v3.

The runner is online once a snapshot is accepted. Disconnecting clears the snapshot. WebSocket ping and pong frames detect dead connections. The runner retries transient failures with delays from 1 to 30 seconds and exits when its credentials are rejected.

Docker labels identify the runner, player profile, game, and instance. The runner recovers live instances by inspecting its own containers, then publishes the recovered snapshot. Readiness uses the bundled agent on the container’s loopback address and times out after 20 seconds. If Docker is unavailable, the runner disconnects until it can read the inventory again.

Duplicate Play uses the current instance. A retry after failure creates a new instance with the same save volume. Stop cancels a pending launch or removes the identified container and leaves its volume available for the next Play.
