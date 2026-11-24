# Backend guidelines

- Use strict TypeScript and native Node 24-compatible syntax. Include the `.ts` extension on relative imports.
- Keep Express handlers focused on HTTP. Move SQL or business logic out when it needs its own tests or another caller.
- Validate request data at the HTTP boundary. Return safe JSON errors. Keep credentials, session tokens, and password hashes out of responses and logs.
- Enforce authorization on the server for each protected action. Current account state is authoritative.
- Use parameter binding for user-controlled SQLite values. Use transactions for changes that must succeed together and migrations when an existing schema changes.
- Run `npm run check` and `npm test` from `game-session-service/` after backend changes.
