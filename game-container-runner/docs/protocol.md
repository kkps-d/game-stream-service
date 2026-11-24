# Runner protocol

The runner connects to `/api/runners/connect` with its token in an `Authorization: Bearer` header. Use a loopback `ws://` URL for local development and a `wss://` URL for remote deployments. The session service accepts one active connection for its configured runner.

Protocol version 1 sends a JSON `snapshot` with the full game catalog and container list on each connection. Shared TypeScript types live in [the repository protocol directory](../../protocol/runner.ts). The session service validates the snapshot before exposing it to admins.

The runner is online once a snapshot is accepted. Disconnecting clears the snapshot. WebSocket ping and pong frames detect dead connections. The runner retries transient failures with delays from 1 to 30 seconds and exits when its credentials are rejected.
