import WebSocket from 'ws';
import type { RunnerSnapshot } from '../../../../../protocol/runner.ts';
import type { ConnectionResult, RunnerConfig } from '../types/connection.ts';

export function reportSnapshot(
  config: RunnerConfig,
  getSnapshot: () => RunnerSnapshot,
  signal: AbortSignal,
): Promise<ConnectionResult> {
  if (signal.aborted) return Promise.resolve('unavailable');

  return new Promise((resolve) => {
    const socket = new WebSocket(config.url, {
      headers: { Authorization: `Bearer ${config.token}` },
      handshakeTimeout: 5_000,
      perMessageDeflate: false,
      followRedirects: false,
    });
    let result: ConnectionResult = 'unavailable';
    let heartbeat: NodeJS.Timeout | undefined;
    const disconnect = () => socket.terminate();

    const expectPing = () => {
      clearTimeout(heartbeat);
      heartbeat = setTimeout(disconnect, 35_000).unref();
    };

    signal.addEventListener('abort', disconnect, { once: true });
    socket.on('error', disconnect);
    socket.on('ping', expectPing);
    socket.once('unexpected-response', (_request, response) => {
      if (response.statusCode === 401 || response.statusCode === 403) result = 'rejected';
      response.destroy();
      disconnect();
    });
    socket.once('open', () => {
      expectPing();
      socket.send(JSON.stringify(getSnapshot()), (error) => {
        if (error) {
          disconnect();
          return;
        }
        result = 'reported';
      });
    });
    socket.once('close', () => {
      clearTimeout(heartbeat);
      signal.removeEventListener('abort', disconnect);
      resolve(result);
    });
  });
}
