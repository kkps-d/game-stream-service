# Work

- Scaffold `game-container-runner` in this repository. Keep the existing `game-coordinator-small` available for local testing.
- Connect the runner to `game-session-service` using an authenticated outbound WebSocket. Report the game catalog and container state. Sync users to stable runner profiles.
- Verify a local Play flow using a stub launcher, a reconnect, and a second user. Then launch one existing game with Docker.
- Start the web-remote-desktop agent with session service and coturn settings. Redeem a one-time launch token, authorize player signaling, and verify relay-only media and input with local coturn.
- Test across internet NAT once a public endpoint is available.
