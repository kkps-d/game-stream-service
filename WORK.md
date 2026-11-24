# Work

## Local OpenArena streaming

- [ ] **Container networking.** Have the runner launch OpenArena on the [private coturn bridge](infra/coturn/README.md). Make the session service reachable from that bridge and keep game container ports unpublished.
- [ ] **Agent registration.** Pass a short-lived, one-time token tied to the game instance. Have the agent redeem it over an outbound connection to the session service. Keep the standalone desktop streaming mode available.
- [ ] **Player authorization and signaling.** Check that the signed-in player owns the instance before forwarding the WebRTC offer and answer. Issue short-lived TURN credentials to the browser and agent. Close the stream when the instance stops.
- [ ] **Agent and viewer integration.** Add TURN support to the agent and rebuild the OpenArena image. Wire the viewer into the player panel so the player can see, hear, and control the game.
- [ ] **Local acceptance test.** Sign in, select **Play**, see and hear OpenArena, and control it with keyboard and mouse. Verify TURN carries the stream, a second account cannot view the instance, and **Stop** closes the stream.

## Internet testing

- [ ] Test across internet NAT once a public endpoint is available.
