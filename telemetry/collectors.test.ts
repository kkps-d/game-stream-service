import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readCgroupFiles } from './cgroup.ts';
import { parseNvidiaLine } from './nvidia.ts';
import { createViewerMetrics } from './session.ts';
import { frameBuckets, prepareSnapshots, readEncoder, readFrames } from './snapshots.ts';

test('reports cgroup CPU affinity, quota, RAM charge, and cumulative events', async (t) => {
  const path = await mkdtemp(join(tmpdir(), 'telemetry-cgroup-'));
  t.after(() => rm(path, { force: true, recursive: true }));
  const files = {
    'cpu.stat': 'usage_usec 2000000\nthrottled_usec 22000\n',
    'cpuset.cpus.effective': '1-3,7',
    'cpu.max': '200000 100000',
    'memory.current': '1048576',
    'memory.max': 'max',
    'memory.events': 'max 11\noom 2\noom_kill 1\n',
  };
  await Promise.all(
    Object.entries(files).map(([name, value]) => writeFile(join(path, name), value)),
  );
  assert.deepEqual(await readCgroupFiles(path), {
    cpuSeconds: 2,
    cpuAllowed: 4,
    cpuQuota: 2,
    throttledSeconds: 0.022,
    memoryBytes: 1_048_576,
    memoryLimit: undefined,
    memoryLimitHits: 11,
    oomKills: 1,
  });
});

test('validates histogram snapshots and drops stale or redirected samples', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'telemetry-snapshots-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const instance = 'd5b5b7a5-0392-46c4-9e35-c36195ce9b57';
  const path = await prepareSnapshots(root, instance);
  const snapshot = {
    version: 1,
    presented: 5,
    lastFrameMs: 22_000,
    buckets: frameBuckets.map((edge) => (edge >= 0.02 ? 4 : 0)),
    intervals: 4,
    sumNanoseconds: 80_000_000,
  };
  await writeFile(join(path, 'frames.json'), JSON.stringify(snapshot));
  assert.equal((await readFrames(root, instance))?.sumSeconds, 0.08);
  await symlink('frames.json', join(path, 'encoder.json'));
  assert.equal(await readEncoder(root, instance), undefined);
  await writeFile(join(path, 'frames.json'), JSON.stringify({ ...snapshot, buckets: [] }));
  assert.equal(await readFrames(root, instance), undefined);
  await writeFile(join(path, 'frames.json'), JSON.stringify(snapshot));
  await utimes(join(path, 'frames.json'), 0, 0);
  assert.equal(await readFrames(root, instance), undefined);
});

test('NVIDIA samples retain supported fields and normalize the PCI domain', () => {
  assert.deepEqual(parseNvidiaLine('00000000:01:00.0, 13, 512, 16303, [N/A]'), {
    pci: '0000:01:00.0',
    gpu: 13,
    memoryUsed: 512 * 1024 ** 2,
    memoryTotal: 16303 * 1024 ** 2,
    encoder: undefined,
  });
});

test('viewer reports are bounded, rate limited, expire, and follow session replacement', () => {
  let now = 0;
  const viewers = createViewerMetrics('runner', () => now);
  viewers.started('game-instance', 'minecraft', 'viewer-1');
  assert.equal(viewers.report('game-instance', 'viewer-1', { rttMs: 70, user: 1 }), 400);
  assert.equal(viewers.report('game-instance', 'viewer-1', { rttMs: 70, fps: 59 }), 204);
  assert.match(viewers.metrics().render(), /game_stream_browser_rtt_seconds.* 0.07/);
  assert.equal(viewers.report('game-instance', 'viewer-1', { fps: 60 }), 429);
  now = 5000;
  assert.equal(viewers.metrics().render(), '');
  viewers.started('game-instance', 'minecraft', 'viewer-2');
  assert.equal(viewers.report('game-instance', 'viewer-1', { fps: 60 }), 404);
  viewers.stopped('game-instance', 'viewer-1');
  assert.equal(viewers.report('game-instance', 'viewer-2', { fps: 60 }), 204);
  viewers.reconcile(new Set());
  assert.equal(viewers.metrics().render(), '');
});
