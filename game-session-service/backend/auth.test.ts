import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.ts';
import { createAccount } from './features/auth/services/accounts.ts';
import { sessions } from './features/auth/services/schema.ts';
import { createSessionServer } from './http-server.ts';

const origin = 'http://localhost:5180';
const options = {
  sessionSecret: 'test-secret-test-secret-test-secret',
  origins: new Set([origin]),
  secureCookies: false,
};
const password = 'test-account-password';

async function listen(filename: string) {
  const { db, close } = openDatabase(filename);
  const server = await createSessionServer(db, options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  return {
    db,
    request(path: string, init?: RequestInit) {
      return fetch(`http://127.0.0.1:${address.port}/api/${path}`, init);
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      close();
    },
  };
}

function login(username: string, pass = password, requestOrigin = origin): RequestInit {
  return {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: pass }),
  };
}

test('authenticates local accounts, persists sessions, and checks admin access', async (context) => {
  const dir = mkdtempSync(join(tmpdir(), 'game-session-test-'));
  const filename = join(dir, 'auth.sqlite');
  let service: Awaited<ReturnType<typeof listen>> | undefined;
  context.after(async () => {
    await service?.close();
    rmSync(dir, { recursive: true, force: true });
  });
  assert.throws(() => openDatabase(filename), /npm run db:push/);
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../node_modules/drizzle-kit/bin.js', import.meta.url)), 'push'],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, DATABASE_PATH: filename },
    },
  );

  service = await listen(filename);
  await createAccount(service.db, 'Player', password, 'user');
  await createAccount(service.db, 'Operator', password, 'admin');
  await assert.rejects(createAccount(service.db, 'PLAYER', password, 'user'), {
    message: 'That username is already in use.',
  });

  assert.equal((await service.request('health')).status, 200);
  assert.equal((await service.request('session')).status, 401);
  assert.equal((await service.request('sign-in', login('player', 'wrong'))).status, 401);
  assert.equal(
    (await service.request('sign-in', login('player', password, 'https://other.test'))).status,
    403,
  );
  assert.equal((await service.request('admin/sign-in', login('player'))).status, 401);

  const player = await service.request('sign-in', login('PLAYER'));
  assert.equal(player.status, 200);
  assert.deepEqual(await player.json(), { user: { id: 1, username: 'player', role: 'user' } });
  const setCookie = player.headers.get('set-cookie');
  assert(setCookie?.includes('HttpOnly'));
  assert(setCookie?.includes('SameSite=Lax'));
  const playerCookie = setCookie!.split(';')[0];
  assert.equal(
    (await service.request('admin/session', { headers: { Cookie: playerCookie } })).status,
    403,
  );

  const admin = await service.request('admin/sign-in', login('operator'));
  assert.equal(admin.status, 200);
  const adminCookie = admin.headers.get('set-cookie')!.split(';')[0];

  const runner = await service.request('admin/runner', { headers: { Cookie: adminCookie } });
  assert.equal(runner.status, 200);
  assert.deepEqual(await runner.json(), { runner: null });

  await service.close();
  service = undefined;
  service = await listen(filename);

  assert.equal(
    (await service.request('session', { headers: { Cookie: playerCookie } })).status,
    200,
  );
  const adminSession = await service.request('admin/session', { headers: { Cookie: adminCookie } });
  assert.equal(adminSession.status, 200);
  assert.deepEqual(await adminSession.json(), {
    user: { id: 2, username: 'operator', role: 'admin' },
  });

  assert.equal(
    (
      await service.request('sign-out', {
        method: 'POST',
        headers: { Origin: origin, Cookie: adminCookie },
      })
    ).status,
    204,
  );
  assert.equal(
    (await service.request('admin/session', { headers: { Cookie: adminCookie } })).status,
    401,
  );

  const expired = service.db
    .update(sessions)
    .set({ expiresAt: Date.now() - 1 })
    .run();
  assert.equal(expired.changes, 1);
  assert.equal(
    (await service.request('session', { headers: { Cookie: playerCookie } })).status,
    401,
  );
});
