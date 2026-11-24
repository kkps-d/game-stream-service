import { execFile } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function resolveGpu(pci: string): Promise<string[]> {
  const drm = `/dev/dri/by-path/pci-${pci}`;
  const [card, render, vendor] = await Promise.all([
    realpath(drm + '-card'),
    realpath(drm + '-render'),
    readFile(`/sys/bus/pci/devices/${pci}/vendor`, 'utf8'),
  ]).catch((error: unknown) => {
    throw new Error(`Could not resolve the DRM devices for RUNNER_GPU_PCI=${pci}.`, {
      cause: error,
    });
  });
  const [cardInfo, renderInfo] = await Promise.all([stat(card), stat(render)]);
  const groups = Array.from(new Set([cardInfo.gid, renderInfo.gid])).flatMap((group) => [
    '--group-add',
    String(group),
  ]);

  if (vendor.trim() === '0x1002') return ['--device', card, '--device', render, ...groups];
  if (vendor.trim() !== '0x10de') throw new Error(`Unsupported GPU vendor at ${pci}.`);

  const { stdout } = await exec(
    'nvidia-smi',
    [`--id=${pci}`, '--query-gpu=uuid', '--format=csv,noheader'],
    { timeout: 5_000 },
  );
  const uuid = stdout.trim();
  if (!/^GPU-[\da-f-]+$/i.test(uuid))
    throw new Error(`Could not resolve the NVIDIA GPU at ${pci}.`);
  return ['--device', `nvidia.com/gpu=${uuid}`, ...groups];
}
