# Backend guidelines

- Use strict TypeScript and native Node 24-compatible syntax. Include the `.ts` extension on relative imports.
- Group backend code by feature. Use `types/` for domain types and DTOs, `services/` for application logic and persistence, and `controller/` for HTTP and CLI entry points.
- Validate request and message data at the HTTP or WebSocket boundary. Return safe JSON errors. Keep credentials, session tokens, and password hashes out of responses and logs.
- Enforce authorization on the server for each protected action. Current account state is authoritative.
- Use Drizzle for SQLite queries and transactions. Manage the local schema in TypeScript and apply it with `npm run db:push`.
- Run `npm run check` and `npm test` from `game-session-service/` after backend changes.
