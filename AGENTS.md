# AGENTS.md

## Code

- Follow YAGNI. Build what the current task needs. Add abstractions and utilities only when they make the code easier to understand or avoid meaningful duplication.
- Use descriptive names and straightforward control flow. Let the code explain what it does. Comment on the reason behind a choice or a constraint when the code cannot explain it.
- Run the formatter after every code edit. Run the relevant builds and tests for meaningful changes. Report any verification you could not complete.
- Keep changes within the task. If a refactor would materially improve the solution, stop before refactoring and propose its scope and trade-offs to the user.
- Keep platform boundaries clear. Share platform-independent logic and put platform-specific behavior in the module that owns that platform.
- Use Conventional Commits. Add the feature in parentheses when helpful, for example `feat(auth): add username sign-in`.

## Documentation

- Write short, readable docs. Keep the root README as an index to services and shared docs. Cover purpose, setup, features, and known issues in each service README.
- Give each service a README and a `docs/` directory. Keep language-specific tooling and dependencies with the service. Document setup and design there. Use the root `docs/` for material shared across services.
- Maintain `WORK.md` with active requirements, decisions, and work in progress. Move completed or inactive items to `WORK-DONE.md`.
