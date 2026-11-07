# Game Stream Service

**Status:** Brainstorming / preliminary architecture

Current work is limited to discussion and documentation. Writing code, scaffolding applications, or building prototypes requires explicit user authorization.

See [Terminology](terminology.md) for short definitions of technical terms.

See [Game storage](storage.md) for the proposed per-game image, Compose configuration, and user-data storage model.

See [Smallest MVP](mvp.md) for a proposed two-player local-network demonstration, build order, and acceptance criteria.

## Vision

Build a multi-user game streaming service where one Linux host can run multiple independent instances of games or applications concurrently. Each user receives their own video/audio stream and independent keyboard, mouse, and controller inputs.

## Proposed architecture

- **Host:** Bare-metal Linux with consumer AMD/NVIDIA graphics; share GPU rendering and encoding without virtual machines.
- **Sessions:** One Podman container per user, with Linux namespaces and cgroups for process, filesystem, and resource isolation.
- **Graphics:** Separate headless Wayland compositor per session, with XWayland for X11 games and Wine/Proton applications. Evaluate Gamescope and Weston.
- **Input:** Route each user's peripherals to their own compositor/session, ideally without granting containers broad access to host input devices.
- **Streaming:** Per-session video/audio capture, hardware encoding, and low-latency WebRTC delivery.
- **Orchestration:** Host-side service to create, monitor, and terminate sessions.

## Proposed container image strategy

1. **Linux base:** Minimal userspace, GPU drivers/userspace libraries, Vulkan and shared dependencies.
2. **Session runtime:** Wayland/XWayland, audio, input integration, capture and streaming components.
3. **Compatibility variants:** Native Linux or Wine/Proton/DXVK/VKD3D as needed.
4. **Game-specific image/configuration:** Launch settings and game dependencies. Prefer shared read-only game assets and private writable user data where practical.

## Main engineering risks

- GPU sharing, VRAM contention, encoder capacity, and hardware-specific driver behavior.
- Reliable headless acceleration, capture, and independent input focus.
- Game compatibility, anti-cheat restrictions, and licensing.
- Container security: namespaces do not isolate the shared GPU kernel driver.
- Latency, audio routing, and operational stability.

## Proposed future prototype milestones

These are candidate validation steps for a future implementation phase, not current tasks.

1. Run two GPU-accelerated applications in independent Podman sessions.
2. Give each session a separate Wayland/XWayland display.
3. Verify independent mouse, keyboard, and controller routing.
4. Stream independent video/audio feeds to two clients.
5. Add a basic session manager and browser client.
6. Test real games through native Linux and Proton paths.

## Proposed future development approach

If implementation is authorized, consider AI coding agents for scaffolding, integration, tests, and debugging, with human review of hardware-specific issues, security, and architectural tradeoffs. Validate small milestones on the actual GPU host.

## Open decisions

- Gamescope vs Weston for the session compositor.
- AMD vs NVIDIA target GPU and encoder capabilities.
- Exact input-injection and capture interfaces.
- Session runtime placement: inside containers versus selected host-side services.
- How to package games and manage persistent user data.

*All technologies and design choices are provisional pending proof-of-concept testing.*
