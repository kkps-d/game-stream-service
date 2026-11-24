# Runner protocol

The runner connects to `/api/runners/connect` with its token in an `Authorization: Bearer` header. Use a loopback `ws://` URL for local development and a `wss://` URL for remote deployments. The session service accepts one active connection for its configured runner.

Protocol version 2 uses JSON in both directions. The service sends `play` and `stop` commands with a profile ID and game ID. Stop also includes the exact instance ID. The runner publishes a full `snapshot` on connect and after each state change. The snapshot contains the catalog and profile-owned instances in `starting`, `running`, or `stopping` state. The service validates and filters the snapshot before serving player requests.

Shared TypeScript types live in [the repository protocol directory](../../protocol/runner.ts). Upgrade the API and runner together when switching to v2.

The runner is online once a snapshot is accepted. Disconnecting clears the snapshot. WebSocket ping and pong frames detect dead connections. The runner retries transient failures with delays from 1 to 30 seconds and exits when its credentials are rejected.

The stub stores instances in runner memory. Reconnecting the socket or restarting the API recovers the same instances from a fresh snapshot. Restarting the runner clears them. A duplicate Play reuses the current instance within the same profile and game. Stop cancels a pending start if needed.
