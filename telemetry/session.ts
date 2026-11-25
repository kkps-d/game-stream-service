import { listenMetrics, Metrics } from './metrics.ts';

const fields = {
  fps: ['game_stream_browser_decoded_fps', 1000],
  droppedFrames: ['game_stream_browser_dropped_frames', Number.MAX_SAFE_INTEGER],
  rttMs: ['game_stream_browser_rtt_seconds', 120_000],
  lossPercent: ['game_stream_browser_packet_loss_percent', 100],
} as const;

type ViewerSample = Partial<Record<keyof typeof fields, number>>;

interface Viewer {
  game: string;
  session: string;
  sampledAt?: number;
  sample?: ViewerSample;
}

function parseSample(body: unknown): ViewerSample | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;
  const values = Object.entries(body);
  if (!values.length) return;
  for (const [key, value] of values) {
    if (!Object.hasOwn(fields, key)) return;
    const [, limit] = fields[key as keyof typeof fields];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > limit ||
      (key === 'droppedFrames' && !Number.isInteger(value))
    )
      return;
  }
  return body as ViewerSample;
}

export function createViewerMetrics(runner: string, now = () => performance.now()) {
  const viewers = new Map<string, Viewer>();
  return {
    started(instance: string, game: string, session: string) {
      viewers.set(instance, { game, session });
    },
    stopped(instance: string, session: string) {
      if (viewers.get(instance)?.session === session) viewers.delete(instance);
    },
    reconcile(running: ReadonlySet<string>) {
      for (const instance of viewers.keys()) if (!running.has(instance)) viewers.delete(instance);
    },
    report(instance: string, session: string, body: unknown) {
      const viewer = viewers.get(instance);
      if (!viewer || viewer.session !== session) return 404;
      const nowMs = now();
      if (viewer.sampledAt !== undefined && nowMs - viewer.sampledAt < 750) return 429;
      const sample = parseSample(body);
      if (!sample) return 400;
      viewer.sampledAt = nowMs;
      viewer.sample = sample;
      return 204;
    },
    metrics() {
      const metrics = new Metrics();
      const nowMs = now();
      for (const [game_instance, viewer] of viewers) {
        if (!viewer.sample || viewer.sampledAt === undefined || nowMs - viewer.sampledAt >= 5000)
          continue;
        for (const [field, [name]] of Object.entries(fields)) {
          const value = viewer.sample[field as keyof typeof fields];
          metrics.add(name, field === 'rttMs' && value !== undefined ? value / 1000 : value, {
            runner,
            game: viewer.game,
            game_instance,
          });
        }
      }
      return metrics;
    },
  };
}

export type ViewerMetrics = ReturnType<typeof createViewerMetrics>;

export function startSessionMetrics(
  viewers: ViewerMetrics,
  runner: string,
  countLobbies?: () => number,
) {
  return listenMetrics(9465, {
    '/metrics': viewers.metrics,
    '/metrics/lobbies'() {
      const metrics = new Metrics();
      metrics.add('game_stream_active_lobbies', countLobbies?.(), { runner });
      return metrics;
    },
  });
}
