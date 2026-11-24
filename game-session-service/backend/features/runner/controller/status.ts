import express from 'express';
import { requireAdminSession } from '../../auth/controller/auth.ts';
import type { RunnerRegistry } from '../services/status.ts';

export function createRunnerStatusRouter(registry: RunnerRegistry) {
  const router = express.Router();
  router.get('/admin/runner', requireAdminSession, (_request, response) => {
    response.json({ runner: registry.read() });
  });
  return router;
}
