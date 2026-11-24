# Frontend guidelines

- Keep player and admin code in `src/` and `src-admin/` respectively. Each panel imports its own code and cross-panel code from `src-shared/`.
- Organize each source tree by feature and panel-wide shared code. Use `layout/` for pages, `components/` for reusable UI, `hooks/` for API bindings and React hooks, and `lib/` for helpers.
- Keep each TanStack Router tree at the panel boundary. Load route data and check sessions in the router. Keep form and interaction state local to components.
- Fetch the API through same-origin paths. Use the session endpoint to check sign-in state and let the backend enforce permissions. Keep credentials and session tokens out of browser storage.
- Build on shadcn/ui primitives and shared Tailwind tokens. Use semantic elements, labeled fields, visible focus, and accessible error feedback.
- Run `npm run build` from `game-session-service/` and check any changed UI in the affected panel.
