import express, { type Response } from 'express';
import { requireUserSession } from '../../auth/controller/auth.ts';
import type { AgentRegistrations } from '../../agent/services/registrations.ts';
import type { RunnerRegistry } from '../../runner/services/status.ts';
import { createGamesService } from '../services/catalog.ts';
import type { GameCommandResult } from '../types/action.ts';

function respond(response: Response, result: GameCommandResult) {
  if (result === 'accepted') {
    response.sendStatus(202);
  } else if (result === 'not-found') {
    response.status(404).json({ error: 'Game or game instance not found.' });
  } else {
    response
      .status(503)
      .json({ error: 'The game runner is unavailable. Try again when it reconnects.' });
  }
}

export function createGamesRouter(
  runners: RunnerRegistry,
  registrations?: AgentRegistrations,
  streaming = false,
) {
  const router = express.Router();
  const games = createGamesService(runners, registrations, streaming);

  router.get('/games', requireUserSession, (request, response) => {
    response.json(games.list(request.user!.id));
  });

  router.post<{ gameId: string }>(
    '/games/:gameId/play',
    requireUserSession,
    async (request, response) => {
      respond(
        response,
        await games.send(request.user!.id, request.params.gameId, {
          type: 'play',
          username: request.user!.username,
        }),
      );
    },
  );

  router.post<{ gameId: string }>(
    '/games/:gameId/stop',
    requireUserSession,
    async (request, response) => {
      const body = request.body as { instanceId?: unknown } | undefined;
      if (typeof body?.instanceId !== 'string' || !body.instanceId.trim()) {
        response.status(400).json({ error: 'Provide a game instance ID.' });
        return;
      }
      respond(
        response,
        await games.send(request.user!.id, request.params.gameId, {
          type: 'stop',
          instanceId: body.instanceId,
        }),
      );
    },
  );

  return router;
}
