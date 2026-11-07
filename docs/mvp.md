# Smallest MVP

**Status:** Recommendation for discussion; implementation is not authorized and technology choices remain open.

## Goal

Two people on the same local network independently play two instances of one native Linux game on one Linux host and one shared GPU.

A single working stream is the first checkpoint. Two simultaneous, independent sessions are the MVP because multi-user GPU sharing is central to this project.

## Scope

- One existing Linux host and one GPU model; no support matrix.
- One lightweight native Linux game that can be redistributed for testing and has persistent settings or saves.
- Two trusted testers with fixed session identities on the local network.
- One Podman container per player, each with its own headless display, audio, input routing, and private persistent data.
- An existing streaming server/client combination, subject to proving it supports separate concurrent sessions. Start with keyboard and mouse.
- Manual launch and stop through a small script or one tested Compose configuration. No web dashboard is required.

Use hardware rendering and encoding on the target GPU. Start with a proposed target of 720p at 30 frames per second per session; measure performance before expanding scope.

## Build order after authorization

1. Run the chosen game with GPU acceleration in one container and a headless display.
2. Connect one remote client with video, audio, keyboard, and mouse. Verify the encoder uses the GPU.
3. Launch a second session using the same game image and separate runtime resources and writable data. Connect a second client.
4. Verify independence, persistent data, and cleanup before adding management features.

## Acceptance demonstration

- Both testers play simultaneously for 15 minutes at the proposed stream target; record actual frame rates, latency, GPU load, and memory use.
- Each tester receives only their own video and audio; keyboard and mouse actions affect only their own session.
- Each session uses a distinct writable data directory. Saved state or settings survive removing and recreating its container.
- Stopping one session leaves the other running. Stopping both releases their processes and temporary resources while preserving persistent data.

This validates functionality for trusted testers; it does not establish isolation against hostile users on a shared GPU.

## Defer

Windows games and Proton, controllers, multiple games, public internet access, accounts and billing, matchmaking, multiple hosts, custom streaming protocols, and a custom browser client.

If browser playback is essential, select an existing WebRTC-capable stack during the one-session checkpoint. WebRTC still needs signaling to exchange connection information, so browser delivery adds integration work even before internet connectivity is considered. See [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections).

## Open choices

Confirm the available Linux host and GPU, then test one compositor and one streaming stack with that hardware. Do not build competing variants initially. GPU device permissions must be checked for the chosen Podman setup; see [Podman run documentation](https://docs.podman.io/en/latest/markdown/podman-run.1.html).

Use the existing [storage proposal](storage.md) for private saves and disposable session files. A custom session manager comes after the two-session demonstration passes.
