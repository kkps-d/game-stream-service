# Architecture

The game-session-service owns accounts, roles, game session authorization, and the player and admin panels.

The planned game-container-runner owns game containers on the on-premises host. It opens an authenticated outbound WebSocket to the session service, receives profile updates and launch commands, and reports game and container state. The session service maps stable user IDs to runner profiles.

After launch, the web-remote-desktop agent will redeem a one-time token over its own outbound connection. The session service will route WebRTC signaling and issue temporary coturn credentials. coturn will relay media and input. The game host will only initiate outbound connections.

The game deployment uses the standalone web-remote-desktop agent. orchprox is a separate deployment for standalone desktop streaming. The existing containerz game-coordinator-small remains a local testing tool.
