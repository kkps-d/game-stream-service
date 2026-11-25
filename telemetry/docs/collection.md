# Metric collection

Prometheus scrapes game performance, viewer stats, GPU utilization, and host CPU every second. Host RAM, uplink traffic, and GPU memory are scraped every five seconds. Game and lobby counts are scraped every ten seconds.

The runner reports container CPU consumption in logical cores, CPU set capacity, quota and throttle time when configured, and RAM charged against the cgroup hard limit. OOM kills and limit hits are cumulative. The session service counts unexpired lobbies, and the runner counts their Docker bridges. Empty lobbies stay visible during the existing five-minute grace period.

Gamescope counts newly presented frames on the focused game window. Its histogram measures intervals between those frames. Grafana estimates p95 and p99 from the bucket counts. The encoder counter follows the agent process across viewer reconnects. Viewer series appear during a game stream and expire five seconds after the last report. Browser and GPU metrics depend on counter availability.

## Remote collection

The development endpoints listen on loopback. For a remote Prometheus, forward ports 9100, 9464, and 9465 over a private SSH tunnel. Copy the scrape jobs from `prometheus.yml` to that server and point them at the forwarded ports. Run Grafana on the remote monitoring machine and set its data source to the remote Prometheus.

## Local verification

A cgroup fixture pinned to two logical CPUs with a one-core quota and a 64 MiB memory cap reported the same limit and event counters as the kernel, including an induced OOM kill.

An independent Java frame probe ran Minecraft 1.21.11 in the same test world on the RTX 5080. Each 60 FPS pass sampled 25 seconds. With frame telemetry off and on, p95 was 33.276 ms and 33.278 ms, and p99 was 33.311 ms and 33.313 ms. Gamescope averaged 0.084 and 0.095 logical CPUs over the corresponding 27-second CPU samples. A separate 30 Hz run reported 30.04 FPS. These short runs capture normal variation between launches.

During a 30-second Minecraft stream sample, the runner process used 0.005 logical CPUs and its NVIDIA sampler used 0.002. The runner reading includes its existing work and excludes child process time.

The ten-minute Minecraft 26.3 stream returned 600 points at one-second resolution for each FPS and frame-time series. A deliberate hitch added a frame interval above 250 ms. Viewer metrics expired after closing the viewer and resumed after reconnecting. OpenArena and HoloCure also reported game, encoder, and viewer data. Both lobby counts rose on creation and returned to baseline after expiry.
