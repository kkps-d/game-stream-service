import express, { type ErrorRequestHandler } from 'express';
import type { AuthDatabase } from './database.ts';
import type { AgentRegistrations } from './features/agent/services/registrations.ts';
import type { TurnConfig } from './features/agent/services/turn.ts';
import { createAuthRouter, type AuthOptions } from './features/auth/controller/auth.ts';
import { createStreamsRouter } from './features/games/controller/streams.ts';
import { createGamesRouter } from './features/games/controller/games.ts';
import { createRunnerStatusRouter } from './features/runner/controller/status.ts';
import type { RunnerRegistry } from './features/runner/services/status.ts';

export interface AppOptions extends AuthOptions {
  origins: ReadonlySet<string>;
  turn?: TurnConfig;
  viewerDir?: string;
}

export async function createApp(
  database: AuthDatabase,
  options: AppOptions,
  runners: RunnerRegistry,
  registrations?: AgentRegistrations,
) {
  const app = express();
  app.disable('x-powered-by');
  if (options.secureCookies) app.set('trust proxy', 'loopback');
  if (options.viewerDir) app.use('/viewer', express.static(options.viewerDir));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const origin = request.get('Origin');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      (!origin || !options.origins.has(origin))
    ) {
      response.status(403).json({ error: 'Request origin is not allowed.' });
      return;
    }
    next();
  });

  app.use('/api', await createAuthRouter(database, options));
  app.use('/api', createRunnerStatusRouter(runners));
  app.use('/api', createGamesRouter(runners, registrations, !!options.turn));
  app.use('/api', createStreamsRouter(runners, registrations, options.turn));
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Route not found.' }));
  const handleError: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) return next(error);
    if (error.status === 400 || error.status === 413) {
      response.status(error.status).json({ error: 'Invalid request body.' });
      return;
    }
    console.error(
      'Game session API request failed.',
      error instanceof Error ? error.name : 'Unknown error',
    );
    response.status(500).json({ error: 'The server could not complete the request.' });
  };
  app.use(handleError);
  return app;
}
