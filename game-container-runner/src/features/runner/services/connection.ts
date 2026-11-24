import { setTimeout as delay } from 'node:timers/promises';
import type { ConnectRunner } from '../types/connection.ts';

export async function runRunner(
  connect: ConnectRunner,
  signal: AbortSignal,
  retry = { initialMs: 1_000, maximumMs: 30_000 },
) {
  let waitMs = retry.initialMs;
  while (!signal.aborted) {
    const result = await connect(signal);
    if (signal.aborted) break;
    if (result === 'rejected') return 'rejected';
    if (result === 'reported') waitMs = retry.initialMs;

    try {
      await delay(waitMs, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) throw error;
    }
    waitMs = Math.min(waitMs * 2, retry.maximumMs);
  }
  return 'stopped';
}
