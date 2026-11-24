# Work

- Sync session service users to stable runner profiles. Use `game-coordinator-small` as the local reference for Docker launch behavior.
- Verify a local Play flow using a stub launcher, a reconnect, and a second user. Then launch one existing game with Docker.
- Start the web-remote-desktop agent with session service and coturn settings. Redeem a one-time launch token, authorize player signaling, and verify relay-only media and input with local coturn.
- Test across internet NAT once a public endpoint is available.
