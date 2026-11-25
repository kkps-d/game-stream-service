# Work

## Local OpenArena streaming

- [x] **Container networking.** OpenArena can reach the session service and coturn over the [private bridge](game-container-runner/README.md#local-streaming-network).
- [x] **Agent registration.** The agent redeems a one-time instance token over an outbound WebSocket. Stop closes the connection.
- [x] **Player authorization and signaling.** The session service checks ownership before forwarding offers or issuing TURN credentials.
- [x] **Agent and viewer integration.** The player panel opens the game viewer with relay-only video, audio, and input.
- [x] **Local acceptance test.** Verified OpenArena playback, controls, account isolation, and Stop in Chromium.

## LAN lobbies

- [ ] Evaluate VPS networking and rollout after the local lobby tests. Use the
      [local test setup](game-session-service/README.md#test-lan-lobbies-locally).

## VPS streaming

- [ ] Investigate UDP packet loss on the return path from coturn to the player. OpenArena held 60 fps with no freezes locally. Over the VPS relay, High froze 10–11 times and Low 5–8 times in 12-second samples. A capture found 64 of 28,090 video packets missing between the relay and the test host. Recheck the route and negotiated WebRTC packet-loss recovery before raising the launch resolution again.
