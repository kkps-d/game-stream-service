export type GameAction = { type: 'play' } | { type: 'stop'; instanceId: string };

export type GameCommandResult = 'accepted' | 'not-found' | 'unavailable';
