import { constants } from 'node:fs';
import { mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const frameBuckets = [
  0.004, 0.008, 0.012, 0.0167, 0.02, 0.025, 0.0334, 0.05, 0.075, 0.1, 0.25, 0.5, 1,
];

export function runtimeDirectory(runnerId: string) {
  const runtime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.()}`;
  return join(runtime, 'game-stream-telemetry', runnerId);
}

function instanceDirectory(root: string, instanceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new Error('Invalid game instance ID');
  return join(root, instanceId);
}

export async function prepareSnapshots(root: string, instanceId: string) {
  await mkdir(root, { mode: 0o700, recursive: true });
  const path = instanceDirectory(root, instanceId);
  await mkdir(path, { mode: 0o700, recursive: true });
  return path;
}

export async function removeSnapshots(root: string, instanceId: string) {
  await rm(instanceDirectory(root, instanceId), { recursive: true, force: true });
}

async function readSnapshot(root: string, instanceId: string, name: string, now = Date.now()) {
  try {
    const path = join(instanceDirectory(root, instanceId), name);
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 4096 || now - stat.mtimeMs > 5000) return;
      const buffer = Buffer.alloc(4097);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 4096) return;
      const data: unknown = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
      if (data && typeof data === 'object' && 'version' in data && data.version === 1)
        return data as Record<string, unknown>;
    } finally {
      await file.close();
    }
  } catch {
    // A running game may use an older image or stop between inventory and scrape.
  }
}

const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export async function readFrames(root: string, instanceId: string) {
  const data = await readSnapshot(root, instanceId, 'frames.json');
  if (!data) return;
  const { presented, lastFrameMs, buckets, intervals, sumNanoseconds } = data;
  if (
    !count(presented) ||
    !count(lastFrameMs) ||
    !count(intervals) ||
    intervals > presented ||
    !count(sumNanoseconds) ||
    !Array.isArray(buckets) ||
    buckets.length !== frameBuckets.length ||
    !buckets.every(
      (bucket, index) =>
        count(bucket) && bucket <= intervals && (index === 0 || bucket >= buckets[index - 1]),
    )
  )
    return;
  return {
    presented,
    lastFrame: lastFrameMs / 1000,
    buckets: buckets as number[],
    intervals,
    sumSeconds: sumNanoseconds / 1e9,
  };
}

export async function readEncoder(root: string, instanceId: string) {
  const data = await readSnapshot(root, instanceId, 'encoder.json');
  if (data && count(data.framesEncoded) && typeof data.active === 'boolean')
    return { framesEncoded: data.framesEncoded, active: data.active };
}
