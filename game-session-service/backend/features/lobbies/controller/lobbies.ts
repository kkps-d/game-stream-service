import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireUserSession } from '../../auth/controller/auth.ts';
import { LobbyError, type LobbyService } from '../services/lobbies.ts';

export function createLobbiesRouter(lobbies?: LobbyService) {
  const router = express.Router();

  router.get('/lobbies', requireUserSession, (request, response) => {
    const search = typeof request.query.q === 'string' ? request.query.q.slice(0, 80) : '';
    response.json(
      lobbies?.list(request.user!.id, search) ?? {
        enabled: false,
        runnerOnline: false,
        membership: null,
        lobbies: [],
      },
    );
  });

  if (!lobbies) return router;
  const service = lobbies;
  const limit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (request) => String(request.user!.id),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many lobby requests. Try again in a minute.' },
  });

  function action(
    run: (userId: number, body: Record<string, unknown>) => Promise<void>,
  ): RequestHandler {
    return async (request, response) => {
      try {
        await run(request.user!.id, request.body ?? {});
        response.sendStatus(204);
      } catch (error) {
        if (!(error instanceof LobbyError)) throw error;
        response.status(error.status).json({ error: error.message });
      }
    };
  }

  function password(value: unknown) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 128)
      throw new LobbyError(400, 'Use a password of at most 128 characters.');
    return value;
  }

  router.post(
    '/lobbies',
    requireUserSession,
    limit,
    action(async (id, body) => {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 60)
        throw new LobbyError(400, 'Enter a lobby name between 1 and 60 characters.');
      await service.create(id, name, password(body.password));
    }),
  );
  router.post(
    '/lobbies/join',
    requireUserSession,
    limit,
    action(async (id, body) => {
      if (typeof body.code !== 'string' || body.code.length > 20)
        throw new LobbyError(400, 'Enter a lobby code.');
      await service.join(id, body.code.trim().toUpperCase(), password(body.password));
    }),
  );
  router.post(
    '/lobbies/leave',
    requireUserSession,
    action((id) => service.leave(id)),
  );
  return router;
}
