export type GameAction = { type: 'play'; username: string } | { type: 'stop'; instanceId: string };

export type GameCommandResult = 'accepted' | 'not-found' | 'unavailable' | 'lobby-unavailable';
