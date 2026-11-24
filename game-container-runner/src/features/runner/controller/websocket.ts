import WebSocket from 'ws';
import { parseCommand } from '../services/command.ts';
import type { ConnectionResult, RunnerConfig, RunnerControl } from '../types/connection.ts';

export function connectRunner(
  config: RunnerConfig,
  controls: RunnerControl,
  signal: AbortSignal,
): Promise<ConnectionResult> {
  if (signal.aborted) return Promise.resolve('unavailable');

  return new Promise((resolve) => {
    const socket = new WebSocket(config.url, {
      headers: { Authorization: `Bearer ${config.token}` },
      handshakeTimeout: 5_000,
      maxPayload: 64 * 1024,
      perMessageDeflate: false,
      followRedirects: false,
    });
    let result: ConnectionResult = 'unavailable';
    let heartbeat: NodeJS.Timeout | undefined;
    let unsubscribe: (() => void) | undefined;
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
    function sendSnapshot() {
      if (socket.readyState !== WebSocket.OPEN) return;
      const snapshot = controls.snapshot();
      if (!snapshot) {
        disconnect();
        return;
      }
      socket.send(JSON.stringify(snapshot), (error) => {
        if (error) {
          disconnect();
          return;
        }
        result = 'reported';
      });
    }

    socket.on('message', (data, binary) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const command = !binary && Buffer.isBuffer(data) ? parseCommand(data.toString()) : null;
      if (!command) {
        socket.close(1008, 'Invalid runner command');
        return;
      }
      controls.dispatch(command);
    });
    socket.once('open', () => {
      expectPing();
      unsubscribe = controls.subscribe(sendSnapshot);
      sendSnapshot();
    });
    socket.once('close', () => {
      unsubscribe?.();
      clearTimeout(heartbeat);
      signal.removeEventListener('abort', disconnect);
      resolve(result);
    });
  });
}
