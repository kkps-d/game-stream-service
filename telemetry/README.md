# Development telemetry

Grafana opens on the last ten minutes. Prometheus keeps one day of metrics in a Docker volume. The development stack uses Linux host networking and binds its endpoints to loopback.

## Deploy

1. Use a native Linux Docker host with Compose and cgroup v2. Follow the [local streaming setup](../game-container-runner/README.md#local-streaming-network) for coturn, the session service, and the runner.
2. From the `containerz` checkout, build the base and display images before rebuilding the streamer and the game images you want to monitor. Use the [runner build commands](../game-container-runner/README.md#local-streaming-network) for the streamer, game images, and browser viewer. Point the session service's `GAME_VIEWER_DIR` at the rebuilt viewer.

   ```sh
   docker build -t containerz/base:dev images/base
   docker build -t containerz/display:dev images/display
   ```

3. Set `GAME_STREAM_TELEMETRY=1` in both service environments and start or restart the session service and runner. Run the runner as the development user (UID 1000) with a writable `XDG_RUNTIME_DIR`. The runner uses the host's `nvidia-smi` for NVIDIA metrics. Node Exporter reads AMDGPU counters.
4. From the `game-stream-service` repository root, create the ignored Grafana credential file once and start the monitoring containers.

   ```sh
   (umask 077; set -C; printf 'GRAFANA_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 18)" > telemetry/.env)
   docker compose --env-file telemetry/.env -f telemetry/compose.yaml up -d
   docker compose --env-file telemetry/.env -f telemetry/compose.yaml ps
   ```

5. Check that all seven jobs are **Up** in [Prometheus targets](http://127.0.0.1:9090/targets). Open [Grafana](http://127.0.0.1:3300/d/game-stream-host) with username `admin` and the password in `telemetry/.env`. Compose provisions the Prometheus data source and both dashboards. Set **Uplink** to the host's network interface if it differs from `eno1`.
6. Launch a new game from the panel, then open its stream. New containers get the runtime mount for Gamescope and encoder metrics. Viewer metrics appear once video is playing.

## Stop

Save and stop active games from the player panel, then stop the monitoring stack from the repository root.

```sh
docker compose --env-file telemetry/.env -f telemetry/compose.yaml down
```

The named volumes retain Prometheus history and the Grafana account between deployments.

## Read the dashboards

- [Interpret the dashboards](docs/interpretation.md) explains how to find past sessions and locate common bottlenecks.
- [Metric collection](docs/collection.md) lists scrape intervals, local validation results, and private remote collection.

Run `npm --prefix telemetry test` to check the collectors and viewer reporting lifecycle.
