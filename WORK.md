# Work

## Local OpenArena streaming

- [x] **Container networking.** OpenArena can reach the session service and coturn over the [private bridge](game-container-runner/README.md#local-streaming-network).
- [x] **Agent registration.** The agent redeems a one-time instance token over an outbound WebSocket. Stop closes the connection.
- [x] **Player authorization and signaling.** The session service checks ownership before forwarding offers or issuing TURN credentials.
- [ ] **Agent and viewer integration.** Add TURN support to the agent and rebuild the OpenArena image. Wire the viewer into the player panel so the player can see, hear, and control the game.
- [ ] **Local acceptance test.** Sign in, select **Play**, see and hear OpenArena, and control it with keyboard and mouse. Verify TURN carries the stream, a second account cannot view the instance, and **Stop** closes the stream.

## Internet testing

- [ ] Test across internet NAT once a public endpoint is available.
