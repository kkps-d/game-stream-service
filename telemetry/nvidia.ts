import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

export interface NvidiaSample {
  pci: string;
  gpu?: number;
  memoryUsed?: number;
  memoryTotal?: number;
  encoder?: number;
}

const number = (field: string | undefined) =>
  field && /^\d+(?:\.\d+)?$/.test(field) ? Number(field) : undefined;

export function parseNvidiaLine(line: string): NvidiaSample | undefined {
  const [bus, gpu, used, total, encoder] = line.split(',').map((field) => field.trim());
  const pci = /^(?:[0-9a-f]{4})?([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])$/i.exec(
    bus ?? '',
  )?.[1];
  if (!pci) return;
  const memoryUsed = number(used);
  const memoryTotal = number(total);
  return {
    pci: pci.toLowerCase(),
    gpu: number(gpu),
    encoder: number(encoder),
    memoryUsed: memoryUsed === undefined ? undefined : memoryUsed * 1024 ** 2,
    memoryTotal: memoryTotal === undefined ? undefined : memoryTotal * 1024 ** 2,
  };
}

export function collectNvidia(signal: AbortSignal) {
  const devices = new Map<string, { sample: NvidiaSample; at: number }>();

  async function watch() {
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        const child = spawn(
          'nvidia-smi',
          [
            '--query-gpu=pci.bus_id,utilization.gpu,memory.used,memory.total,utilization.encoder',
            '--format=csv,noheader,nounits',
            '--loop=1',
          ],
          { stdio: ['ignore', 'pipe', 'ignore'], signal },
        );
        const lines = createInterface({ input: child.stdout });
        lines.on('line', (line) => {
          const sample = parseNvidiaLine(line);
          if (sample) devices.set(sample.pci, { sample, at: performance.now() });
        });
        child.on('error', () => {});
        child.once('close', () => {
          lines.close();
          devices.clear();
          resolve();
        });
      });
      await delay(5_000, undefined, { signal, ref: false }).catch(() => {});
    }
  }

  void watch();
  return () =>
    Array.from(devices.values()).flatMap(({ sample, at }) =>
      performance.now() - at < 3_000 ? [sample] : [],
    );
}
