import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAccount } from './accounts.ts';
import { createApp } from './app.ts';
import { openDatabase } from './database.ts';

const origin = 'http://localhost:5180';
const options = {
  sessionSecret: 'test-secret-test-secret-test-secret',
  origins: new Set([origin]),
  secureCookies: false,
};
const password = 'test-account-password';

async function listen(filename: string) {
  const database = openDatabase(filename);
  const app = await createApp(database, options);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');

  return {
    database,
    request(path: string, init?: RequestInit) {
      return fetch(`http://127.0.0.1:${address.port}/api/${path}`, init);
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      database.close();
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
  let service = await listen(filename);
  context.after(async () => {
    await service.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await createAccount(service.database, 'Player', password, 'user');
  await createAccount(service.database, 'Operator', password, 'admin');

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

  await service.close();
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
});
