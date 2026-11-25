import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const numeric = (text: string | undefined) => {
  if (!text || !/^\d+$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : undefined;
};

function counters(text = '') {
  return new Map(
    text
      .trim()
      .split('\n')
      .map((line) => {
        const [key, value] = line.split(/\s+/, 2);
        return [key, numeric(value)];
      }),
  );
}

function cpuCount(text = '') {
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(text)) return undefined;
  return text.split(',').reduce((sum, range) => {
    const [first, last = first] = range.split('-').map(Number);
    return sum + last! - first! + 1;
  }, 0);
}

function seconds(value: number | undefined) {
  return value === undefined ? undefined : value / 1_000_000;
}

export async function readCgroup(pid: number, dockerId: string) {
  if (!Number.isSafeInteger(pid) || pid < 1 || !/^[a-f0-9]{64}$/.test(dockerId)) return;
  const membership = await readFile(`/proc/${pid}/cgroup`, 'utf8').catch(() => undefined);
  const path = membership
    ?.split('\n')
    .find((line) => line.startsWith('0::/'))
    ?.slice(3);
  if (!path || ![dockerId, `docker-${dockerId}.scope`].includes(path.split('/').at(-1) ?? ''))
    return;

  return readCgroupFiles(join('/sys/fs/cgroup', path));
}

export async function readCgroupFiles(path: string) {
  const read = (file: string) =>
    readFile(join(path, file), 'utf8').then(
      (text) => text.trim(),
      () => undefined,
    );
  const [cpuStat, cpuSet, cpuMax, memory, memoryMax, memoryEvents] = await Promise.all([
    read('cpu.stat'),
    read('cpuset.cpus.effective'),
    read('cpu.max'),
    read('memory.current'),
    read('memory.max'),
    read('memory.events'),
  ]);
  if (cpuStat === undefined) return undefined;
  const cpu = counters(cpuStat);
  const events = counters(memoryEvents);
  const [quota, period] = cpuMax?.split(/\s+/, 2).map(numeric) ?? [];
  return {
    cpuSeconds: seconds(cpu.get('usage_usec')),
    cpuAllowed: cpuCount(cpuSet),
    cpuQuota: quota !== undefined && period ? quota / period : undefined,
    throttledSeconds: seconds(cpu.get('throttled_usec')),
    memoryBytes: numeric(memory),
    memoryLimit: numeric(memoryMax),
    memoryLimitHits: events.get('max'),
    oomKills: events.get('oom_kill'),
  };
}
