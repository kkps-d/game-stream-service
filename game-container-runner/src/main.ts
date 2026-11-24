import { readConfig } from './features/runner/controller/config.ts';
import { connectRunner } from './features/runner/controller/websocket.ts';
import { runRunner } from './features/runner/services/connection.ts';
import { createGameInstances } from './features/runner/services/instances.ts';

try {
  const config = readConfig(process.env);
  const instances = createGameInstances();
  const shutdown = new AbortController();
  process.once('SIGINT', () => shutdown.abort());
  process.once('SIGTERM', () => shutdown.abort());

  console.log('Game container runner started.');
  const result = await runRunner(
    (signal) => connectRunner(config, instances, signal),
    shutdown.signal,
  );
  if (result === 'rejected') {
    console.error('The session service rejected the runner token.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The runner could not start.');
  process.exitCode = 1;
}
