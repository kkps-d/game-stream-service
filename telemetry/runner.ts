import { readdir, realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { readCgroup } from './cgroup.ts';
import { listenMetrics, Metrics } from './metrics.ts';
import { collectNvidia } from './nvidia.ts';
import { frameBuckets, readEncoder, readFrames } from './snapshots.ts';

interface GameMetricsTarget {
  id: string;
  gameId: string;
  dockerId: string;
  status: string;
  pid?: number;
}

interface RunnerSources {
  runnerId: string;
  snapshots: string;
  inventory: () => readonly GameMetricsTarget[] | undefined;
  readiness: () => readonly { id: string; state: string }[] | undefined;
  lobbyNetworks: () => Promise<number>;
  signal: AbortSignal;
}

export function startRunnerMetrics(sources: RunnerSources) {
  const nvidia = collectNvidia(sources.signal);
  const runner = { runner: sources.runnerId };

  async function performanceMetrics() {
    const metrics = new Metrics();
    metrics.type('game_stream_cpu_seconds_total', 'counter');
    metrics.type('game_stream_cpu_throttled_seconds_total', 'counter');
    metrics.type('game_stream_memory_limit_hits_total', 'counter');
    metrics.type('game_stream_oom_kills_total', 'counter');
    metrics.type('game_stream_frames_presented_total', 'counter');
    metrics.type('game_stream_frames_encoded_total', 'counter');
    metrics.type('game_stream_frame_time_seconds', 'histogram');
    for (const gpu of nvidia()) {
      const labels = { ...runner, pci: gpu.pci };
      metrics.add('game_stream_nvidia_gpu_busy_percent', gpu.gpu, labels);
      metrics.add('game_stream_nvidia_encoder_busy_percent', gpu.encoder, labels);
    }

    const readiness = new Map(sources.readiness()?.map(({ id, state }) => [id, state]));
    const games = sources.inventory();
    metrics.add('game_stream_inventory_available', Number(games !== undefined), runner);
    const samples = await Promise.all(
      (games ?? []).map(async (game) => {
        const running = game.status === 'running';
        if (!running) return { game, running };
        const [cgroup, frames, encoder] = await Promise.all([
          game.pid ? readCgroup(game.pid, game.dockerId) : undefined,
          readFrames(sources.snapshots, game.id),
          readEncoder(sources.snapshots, game.id),
        ]);
        return { game, running, cgroup, frames, encoder };
      }),
    );
    for (const { game, running, cgroup, frames, encoder } of samples) {
      const labels = { ...runner, game: game.gameId, game_instance: game.id };
      const state = readiness.get(game.id);
      metrics.add('game_stream_container_running', Number(running), labels);
      metrics.add(
        'game_stream_agent_ready',
        state === undefined ? undefined : Number(state === 'running'),
        labels,
      );
      if (cgroup) {
        metrics.add('game_stream_cpu_seconds_total', cgroup.cpuSeconds, labels);
        metrics.add('game_stream_cpu_logical_allowed', cgroup.cpuAllowed, labels);
        metrics.add('game_stream_cpu_quota_cores', cgroup.cpuQuota, labels);
        if (cgroup.cpuQuota !== undefined)
          metrics.add('game_stream_cpu_throttled_seconds_total', cgroup.throttledSeconds, labels);
        metrics.add('game_stream_memory_bytes', cgroup.memoryBytes, labels);
        metrics.add('game_stream_memory_limit_bytes', cgroup.memoryLimit, labels);
        metrics.add('game_stream_memory_limit_hits_total', cgroup.memoryLimitHits, labels);
        metrics.add('game_stream_oom_kills_total', cgroup.oomKills, labels);
      }
      if (frames) {
        metrics.add('game_stream_frames_presented_total', frames.presented, labels);
        if (frames.lastFrame)
          metrics.add('game_stream_last_frame_timestamp_seconds', frames.lastFrame, labels);
        for (const [index, bound] of frameBuckets.entries())
          metrics.add('game_stream_frame_time_seconds_bucket', frames.buckets[index], {
            ...labels,
            le: String(bound),
          });
        metrics.add('game_stream_frame_time_seconds_bucket', frames.intervals, {
          ...labels,
          le: '+Inf',
        });
        metrics.add('game_stream_frame_time_seconds_sum', frames.sumSeconds, labels);
        metrics.add('game_stream_frame_time_seconds_count', frames.intervals, labels);
      }
      if (encoder) {
        metrics.add('game_stream_frames_encoded_total', encoder.framesEncoded, labels);
        metrics.add('game_stream_encoder_active', Number(encoder.active), labels);
      }
    }
    return metrics;
  }

  return listenMetrics(
    9464,
    {
      '/metrics': performanceMetrics,
      async '/metrics/capacity'() {
        const metrics = new Metrics();
        for (const gpu of nvidia()) {
          const labels = { ...runner, pci: gpu.pci };
          metrics.add('game_stream_nvidia_gpu_memory_used_bytes', gpu.memoryUsed, labels);
          metrics.add('game_stream_nvidia_gpu_memory_total_bytes', gpu.memoryTotal, labels);
        }
        const devices = await readdir('/sys/class/drm').catch(() => []);
        for (const card of devices.filter((name) => /^card\d+$/.test(name))) {
          const device = await realpath(`/sys/class/drm/${card}/device`).catch(() => undefined);
          const pci = device && basename(device);
          if (pci && /^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7]$/.test(pci))
            metrics.add('game_stream_gpu_card_info', 1, { ...runner, card, pci });
        }
        return metrics;
      },
      async '/metrics/inventory'() {
        const metrics = new Metrics();
        const networks = await sources.lobbyNetworks().catch(() => undefined);
        metrics.add('game_stream_lobby_networks', networks, runner);
        const games = sources.inventory();
        if (games) {
          const totals = new Map<string, number>();
          for (const { gameId, status } of games) {
            totals.set(gameId, (totals.get(gameId) ?? 0) + Number(status === 'running'));
          }
          metrics.add(
            'game_stream_running_containers',
            [...totals.values()].reduce((sum, n) => sum + n, 0),
            runner,
          );
          for (const [game, count] of totals)
            metrics.add('game_stream_running_containers_by_game', count, { ...runner, game });
        }
        return metrics;
      },
    },
    sources.signal,
  );
}
