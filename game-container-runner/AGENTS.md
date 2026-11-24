# Runner guidelines

- Use strict TypeScript and native Node 24-compatible syntax. Include the `.ts` extension on relative imports.
- Group code by feature. Use `types/` for domain types and DTOs, `services/` for snapshot and lifecycle logic, and `controller/` for the CLI and WebSocket I/O.
- Validate configuration and incoming data at the boundary. Keep runner tokens out of URLs, snapshots, and logs.
- Keep protocol and connection logic independent of the game host. Put future Docker and host-specific behavior in the module that owns that platform.
- Run `npm run format` after editing, then run `npm run lint`, `npm run check`, and `npm test` from `game-container-runner/`.
