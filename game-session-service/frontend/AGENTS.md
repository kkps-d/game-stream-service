# Frontend guidelines

- Keep player routes and components in `src/` and admin routes and components in `src-admin/`. Put reusable, panel-independent code in `shared/`. Neither panel imports the other.
- Use TanStack Router loaders for route data. Keep form and interaction state local to components. Invalidate the relevant route data after mutations.
- Fetch the API through same-origin paths. Use the session endpoint to check sign-in state and let the backend enforce permissions. Keep credentials and session tokens out of browser storage.
- Build on shadcn/ui primitives and shared Tailwind tokens. Use semantic elements, labeled fields, visible focus, and accessible error feedback.
- Run `npm run build` from `game-session-service/` and check any changed UI in the affected panel.
