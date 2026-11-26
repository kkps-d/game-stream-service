interface GameDefinition {
  title: string;
  image: string;
  savePath: string;
  readinessMs: number;
  offlineName?: true;
  resources?: { cpus: number; memoryMiB: number };
  javaHeapMiB?: number;
  gameFilesPath?: string;
}

export const gameProfiles: ReadonlyMap<string, GameDefinition> = new Map<string, GameDefinition>([
  [
    'openarena',
    {
      title: 'OpenArena',
      image: 'containerz/openarena:dev',
      savePath: '/home/player/.openarena',
      readinessMs: 20_000,
    },
  ],
  [
    'minecraft-1-21-11',
    {
      title: 'Minecraft 1.21.11',
      image: 'containerz/minecraft:1.21.11',
      savePath: '/home/player/.local/share/PineconeMC',
      readinessMs: 60_000,
      offlineName: true,
      resources: { cpus: 4, memoryMiB: 4096 },
      javaHeapMiB: 2048,
    },
  ],
  [
    'holocure',
    {
      title: 'HoloCure',
      image: 'containerz/holocure:dev',
      savePath: '/home/player/.wine-holocure',
      readinessMs: 60_000,
      gameFilesPath: '/opt/holocure',
    },
  ],
]);
