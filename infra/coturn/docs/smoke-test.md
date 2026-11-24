# Chromium relay smoke test

From the coturn directory, create the local config using the [setup guide](../README.md). With Node.js 24 and Docker Compose, run the following commands.

```sh
npm ci --prefix smoke
npm exec --prefix smoke -- playwright install chromium
docker compose --profile smoke config --quiet
docker compose --profile smoke up -d
npm test --prefix smoke
docker compose --profile smoke down
```

Run the last command after a failed test as well. The first run downloads the browser and Docker images.

The test exchanges a data-channel message in both directions between Chromium on the host and Chromium on the internal Docker bridge. It checks the selected ICE candidates on both peers and verifies that coturn rejects a bad password and an expired credential.
