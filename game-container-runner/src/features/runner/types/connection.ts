export type ConnectionResult = 'reported' | 'unavailable' | 'rejected';
export type ConnectRunner = (signal: AbortSignal) => Promise<ConnectionResult>;

export interface RunnerConfig {
  url: URL;
  token: string;
}
