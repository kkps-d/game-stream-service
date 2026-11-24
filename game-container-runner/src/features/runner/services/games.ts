interface GameDefinition {
  title: string;
  image: string;
  savePath: string;
  readinessMs: number;
  offlineName?: true;
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
    'minecraft',
    {
      title: 'Minecraft 26.3',
      image: 'containerz/minecraft:26.3',
      savePath: '/home/player/.local/share/PineconeMC',
      readinessMs: 60_000,
      offlineName: true,
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
