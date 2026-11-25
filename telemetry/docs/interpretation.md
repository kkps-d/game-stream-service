# Interpreting game telemetry

## Find a past run

Open [Game session telemetry](http://127.0.0.1:3300/d/game-stream-game). Set the time picker to when the game ran, select its title under **Game**, then pick an **Instance** to isolate one launch. Use **All** to see multiple runs in the selected window. Prometheus is configured to retain one day of samples, including stopped games. The dashboard opens on the last ten minutes.

For a comparison, use similar scenes, FPS caps, resolutions, and encoder settings. A menu can render at a lower capped rate than gameplay. Drag across an incident in a chart to zoom in, then compare the same time on the other panels.

## Trace frame drops

| What you see                                                         | Where to look next                                                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Game FPS drops and frame time rises                                  | The game presented frames more slowly. Check container CPU, host per-core CPU, GPU utilization, and RAM at the same time.                       |
| Game FPS holds and encoded FPS drops                                 | Look at the capture and encoding path. Check encoder load where available, CPU usage, and stream settings.                                      |
| Game and encoded FPS hold while decoded FPS drops                    | Check viewer dropped frames, WebRTC packet loss, and round-trip time. Also consider browser decoding or device load.                            |
| Container is running and agent is ready, but browser stats are blank | Browser stats are recorded during playback and expire after five seconds without a report. Check **Viewer active** and the last game frame age. |

At 60 FPS a frame takes about **16.7 ms**, and at 30 FPS it takes **33.3 ms**. The p95 and p99 charts estimate the time within which 95% and 99% of frames were presented over a short rolling window. A rising p99 with steady average FPS can expose intermittent stutter.

## Read resource limits

- **CPU.** Two logical cores consumed out of eight allowed means 25% of the container's CPU set. One busy game thread can still fill a single core. When a CPU quota is configured, use **CPU quota throttling** to see time spent waiting for more CPU budget.
- **RAM.** Compare charged usage with the hard limit. Increasing **RAM limit hits** indicate memory pressure at the cap. An increasing **OOM kills** counter means the kernel killed a process. A blank limit series means the collector found no finite limit.
- **Host GPU and network.** Use the [host dashboard](http://127.0.0.1:3300/d/game-stream-host) for shared GPU load, GPU memory, encoder load where supported, and uplink traffic. For AMD integrated graphics, the shared-memory aperture is the addressable range and the used series shows what the driver reports in use.
- **Lobbies.** Logical lobbies and Docker lobby bridges are separate counts. A short gap is possible during provisioning or cleanup. Empty lobbies follow the five-minute grace period.
