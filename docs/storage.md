# Game storage

**Status:** Proposal under discussion; no storage design has been agreed.

## Packaging proposal

The user proposes packaging each game in a Podman container image and keeping a Compose file for each game to describe storage mounts for temporary files and saves.

This fits the proposed shared game assets and private user data architecture. Keep the image and its Compose configuration versioned together so launch settings and paths match the packaged game version.

## Suggested storage model

| Data | Scope | Suggested lifetime and policy |
| --- | --- | --- |
| Game binaries and assets | Shared image version | Read-only during play; replace through image updates. |
| Saves and user settings | User + game | Persistent outside the container; back up independently of images. |
| Shader and other rebuildable caches | User + game, with compatibility/version separation as needed | Retain between sessions for performance; cap size and permit eviction. |
| Temporary files and runtime sockets | Session | Delete after the session; use bounded tmpfs or disk scratch according to size. |
| Wine/Proton prefix, where needed | User + game | Initially persist privately; refine which contents need backup after compatibility testing. |

A Wine/Proton prefix is the game's Windows-like environment, including registry state and user directories. Treating all of it as disposable risks losing state beyond an obvious save directory. Cache and save separation must be verified for each game.

Prefer a read-only container root filesystem with explicit writable mounts where the game supports it. Podman supports read-only roots, writable volumes/bind mounts, and tmpfs. Do not depend on a removable container's writable layer for saves.

## Compose and host-service responsibilities

- Keep common session/runtime defaults in a shared template and per-game differences in the game configuration. The exact mechanism for combining them remains open.
- The game configuration describes paths inside the container and their intended storage lifetimes.
- The host service selects trusted host paths or volume names for the authenticated user, game, and session. Avoid hard-coded user paths, fixed container names, or writable volumes shared by every player.
- Prefer one active writer per user/game save area initially; concurrent sessions need an explicit conflict policy.
- Keep cleanup of session scratch separate from deletion of persistent user data. Define storage limits and save backups at the service level.

Compose is a reasonable initial launch format. Podman's `compose` command delegates to an external provider, so select and test a specific provider before relying on its supported options. A later host service could consume the same storage requirements through another launch mechanism.

## Compatibility and update questions

- Which games write beside their executable or use launchers that modify the installation? Such games need private writable paths or a tested copy-on-write arrangement; never let sessions modify shared game assets.
- For Wine/Proton games, should the full prefix be retained, or can a repeatable prefix be recreated while preserving selected user state?
- How should game/runtime updates affect caches, prefixes, and save compatibility? Rolling back an image does not roll back external saves.
- Should persistent data use explicit host-directory bind mounts or Podman-managed named volumes? Both remain candidates.
- How large are temporary workloads? Do not assume all temporary data fits in memory.

## References

- [Podman run: filesystem and mount options](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
- [Podman Compose: external providers](https://docs.podman.io/en/latest/markdown/podman-compose.1.html)
- [Proton FAQ](https://github.com/ValveSoftware/Proton/wiki/Proton-FAQ)
