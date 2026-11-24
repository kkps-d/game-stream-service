# Work

## Local OpenArena streaming

- [x] **Container networking.** OpenArena can reach the session service and coturn over the [private bridge](game-container-runner/README.md#local-streaming-network).
- [x] **Agent registration.** The agent redeems a one-time instance token over an outbound WebSocket. Stop closes the connection.
- [x] **Player authorization and signaling.** The session service checks ownership before forwarding offers or issuing TURN credentials.
- [x] **Agent and viewer integration.** The player panel opens the game viewer with relay-only video, audio, and input.
- [x] **Local acceptance test.** Verified OpenArena playback, controls, account isolation, and Stop in Chromium.
