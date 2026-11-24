# Architecture

The game-session-service owns accounts, roles, game session authorization, and the player and admin panels.

The game-container-runner opens an authenticated outbound WebSocket from the game host. The session service derives stable profiles from account IDs and sends Play and Stop commands. The runner starts and stops OpenArena containers, gives each profile a named save volume, and reconciles game state from Docker. The session service filters the latest snapshot by player and exposes the full snapshot through its admin API.

After launch, the web-remote-desktop agent redeems a one-time token over its own outbound connection. The local registration path uses the private Docker bridge. The session service will route WebRTC signaling and issue temporary coturn credentials. coturn will relay media and input. The game host will only initiate outbound connections.

The game deployment uses the standalone web-remote-desktop agent. orchprox is a separate deployment for standalone desktop streaming. The existing containerz game-coordinator-small remains a local testing tool.
