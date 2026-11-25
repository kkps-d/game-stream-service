import express, { type Response } from 'express';
import type { ViewerMetrics } from '../../../../../telemetry/session.ts';
import type { AgentRegistrations } from '../../agent/services/registrations.ts';
import { agentTurnUrl, turnCredentials, type TurnConfig } from '../../agent/services/turn.ts';
import type { AgentConnection, AgentReply } from '../../agent/types/signaling.ts';
import { requireUserSession } from '../../auth/controller/auth.ts';
import type { RunnerRegistry } from '../../runner/services/status.ts';

const streamPath = '/games/instances/:instanceId/stream';
const sessionIdPattern = /^[a-f0-9]{32}$/;

function respondError(response: Response, reply: AgentReply | null) {
  if (!reply) {
    response.status(503).json({ error: 'The game agent did not respond. Try again.' });
  } else if (reply.status === 404) {
    response.status(404).json({ error: 'The viewer session has ended.' });
  } else if (reply.status === 400) {
    response.status(400).json({ error: 'The game agent rejected the stream request.' });
  } else {
    response.status(502).json({ error: 'The game agent could not complete the stream request.' });
  }
}

export function createStreamsRouter(
  runners: RunnerRegistry,
  registrations?: AgentRegistrations,
  turn?: TurnConfig,
  viewers?: ViewerMetrics,
) {
  const router = express.Router();
  const stream = express.Router();

  router.use(
    streamPath,
    requireUserSession,
    (request, response, next) => {
      const snapshot = runners.read()?.snapshot;
      if (!snapshot) {
        response.status(503).json({ error: 'The game runner is unavailable.' });
        return;
      }

      const { instanceId } = request.params;
      if (typeof instanceId !== 'string') {
        response.status(404).json({ error: 'Game instance not found.' });
        return;
      }
      const profileId = `user-${request.user!.id}`;
      const instance = snapshot.containers.find(
        ({ id, profileId: owner }) => id === instanceId && owner === profileId,
      );
      if (!instance) {
        response.status(404).json({ error: 'Game instance not found.' });
        return;
      }

      if (instance.state === 'stopping' || instance.state === 'failed') {
        response.status(410).json({ error: 'The game has ended.' });
        return;
      }

      const agent = registrations?.connection(instanceId, profileId, instance.gameId);
      if (!turn || instance.state !== 'running' || !agent) {
        response.status(503).json({ error: 'The game stream is not ready.' });
        return;
      }
      response.locals.agent = agent;
      response.locals.instanceId = instanceId;
      response.locals.gameId = instance.gameId;
      next();
    },
    stream,
  );

  stream.get('/status', (_request, response) => {
    response.sendStatus(204);
  });

  stream.get('/ice', (_request, response) => {
    response.json({ iceServers: [turnCredentials(turn!)] });
  });

  stream.post(
    '/offer',
    express.text({ type: 'application/sdp', limit: '32kb' }),
    async (request, response) => {
      if (typeof request.body !== 'string' || !/^(v=0)\r?\n/.test(request.body)) {
        response.status(400).json({ error: 'Send a WebRTC offer as application/sdp.' });
        return;
      }
      const agent: AgentConnection = response.locals.agent;
      const reply = await agent.request({
        operation: 'offer',
        sdp: request.body,
        turnUrl: agentTurnUrl(turn!),
      });
      if (reply?.status !== 201 || !reply.sessionId || !sessionIdPattern.test(reply.sessionId)) {
        respondError(response, reply);
        return;
      }
      const path = streamPath.replace(
        ':instanceId',
        encodeURIComponent(response.locals.instanceId),
      );
      if (viewers) {
        viewers.started(response.locals.instanceId, response.locals.gameId, reply.sessionId);
        response.set('Game-Stream-Telemetry', '1');
      }
      response
        .status(201)
        .set('Location', `/api${path}/sessions/${reply.sessionId}`)
        .type('application/sdp')
        .send(reply.body);
    },
  );

  stream.param('sessionId', (_request, response, next, sessionId) => {
    if (sessionIdPattern.test(sessionId)) next();
    else response.status(404).json({ error: 'Viewer session not found.' });
  });

  stream.get('/sessions/:sessionId', async (request, response) => {
    const agent: AgentConnection = response.locals.agent;
    const reply = await agent.request({ operation: 'info', sessionId: request.params.sessionId });
    if (reply?.status === 200) response.type('application/json').send(reply.body);
    else respondError(response, reply);
  });

  stream.get('/sessions/:sessionId/stats', async (request, response) => {
    const agent: AgentConnection = response.locals.agent;
    const reply = await agent.request({ operation: 'stats', sessionId: request.params.sessionId });
    if (reply?.status === 200) response.type('application/json').send(reply.body);
    else respondError(response, reply);
  });

  if (viewers) {
    stream.post(
      '/sessions/:sessionId/telemetry',
      express.json({ limit: '1kb' }),
      (request, response) => {
        if (!request.is('application/json')) {
          response.status(415).end();
          return;
        }
        response
          .status(
            viewers.report(response.locals.instanceId, request.params.sessionId, request.body),
          )
          .end();
      },
    );
  }

  stream.patch('/sessions/:sessionId', async (request, response) => {
    if (
      !request.is('application/json') ||
      !request.body ||
      typeof request.body !== 'object' ||
      Array.isArray(request.body)
    ) {
      response.status(400).json({ error: 'Send the stream settings as a JSON object.' });
      return;
    }
    const agent: AgentConnection = response.locals.agent;
    const reply = await agent.request({
      operation: 'update',
      sessionId: request.params.sessionId,
      settings: request.body,
    });
    if (reply?.status === 200) response.type('application/json').send(reply.body);
    else respondError(response, reply);
  });

  stream.delete('/sessions/:sessionId', async (request, response) => {
    const agent: AgentConnection = response.locals.agent;
    const reply = await agent.request({ operation: 'stop', sessionId: request.params.sessionId });
    if (reply?.status === 204 || reply?.status === 404)
      viewers?.stopped(response.locals.instanceId, request.params.sessionId);
    if (reply?.status === 204) response.sendStatus(204);
    else respondError(response, reply);
  });

  return router;
}
