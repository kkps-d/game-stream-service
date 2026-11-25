import { randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, asc, count, eq, gt, isNull, lte, or } from 'drizzle-orm';
import {
  lobbyCodePattern,
  maxLobbies,
  maxLobbyMembers,
  type LobbyDirectory,
  type RunnerLobbySync,
} from '../../../../../protocol/lobbies.ts';
import type { AuthDatabase } from '../../../database.ts';
import { users } from '../../auth/services/schema.ts';
import type { RunnerRegistry } from '../../runner/services/status.ts';
import { lobbies, lobbyMembers } from './schema.ts';

const emptyGraceMs = 5 * 60_000;

export class LobbyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createLobbyService(db: AuthDatabase, runners: RunnerRegistry, now = Date.now) {
  let desired: RunnerLobbySync | undefined;
  const online = () => Boolean(runners.read()?.snapshot?.lobbies);
  const visible = (time = now()) => or(isNull(lobbies.expiresAt), gt(lobbies.expiresAt, time));
  const membership = (userId: number) =>
    db.select().from(lobbyMembers).where(eq(lobbyMembers.userId, userId)).get();
  const members = (lobbyId: string) =>
    db
      .select({ userId: users.id, username: users.username, leaving: lobbyMembers.leaving })
      .from(lobbyMembers)
      .innerJoin(users, eq(users.id, lobbyMembers.userId))
      .where(eq(lobbyMembers.lobbyId, lobbyId))
      .orderBy(asc(users.id))
      .all();

  function requireOnline() {
    if (!online()) throw new LobbyError(503, 'The lobby runner is unavailable.');
  }

  function requireNoMembership(userId: number) {
    if (membership(userId))
      throw new LobbyError(409, 'Leave your current lobby before joining another.');
  }

  function ready(id: string) {
    const status = runners.read()?.snapshot?.lobbies;
    return !!desired && status?.syncId === desired.syncId && status.ready.includes(id);
  }

  function summarize(lobby: typeof lobbies.$inferSelect) {
    return {
      id: lobby.id,
      name: lobby.name,
      code: lobby.code,
      memberCount: members(lobby.id).filter(({ leaving }) => !leaving).length,
      passwordRequired: lobby.passwordHash !== null,
    };
  }

  let syncing = false;
  async function sync() {
    if (syncing || !online()) return;
    syncing = true;
    try {
      const reported = runners.read()?.snapshot?.lobbies;
      const time = now();
      const next = db
        .select()
        .from(lobbies)
        .where(visible(time))
        .orderBy(asc(lobbies.id))
        .all()
        .map(({ id }) => ({
          id,
          profiles: members(id)
            .filter(({ leaving }) => !leaving)
            .map(({ userId }) => `user-${userId}`),
        }));
      if (!desired || JSON.stringify(desired.lobbies) !== JSON.stringify(next)) {
        desired = { version: 4, type: 'lobby-sync', syncId: randomUUID(), lobbies: next };
      }
      if (reported?.syncId === desired.syncId) {
        db.transaction(() => {
          db.delete(lobbyMembers).where(eq(lobbyMembers.leaving, true)).run();
          db.delete(lobbies).where(lte(lobbies.expiresAt, time)).run();
        });
      } else {
        await runners.send(desired);
      }
    } finally {
      syncing = false;
    }
  }

  return {
    sync,
    countActive: () =>
      db.select({ total: count() }).from(lobbies).where(visible()).get()?.total ?? 0,
    list(userId: number, search: string): LobbyDirectory {
      const query = search.trim().toLowerCase();
      const current = membership(userId);
      const lobby =
        current && db.select().from(lobbies).where(eq(lobbies.id, current.lobbyId)).get();
      return {
        enabled: true,
        runnerOnline: online(),
        lobbies: db
          .select()
          .from(lobbies)
          .where(visible())
          .orderBy(asc(lobbies.name), asc(lobbies.id))
          .all()
          .filter(
            ({ name, code }) => name.toLowerCase().includes(query) || code.toLowerCase() === query,
          )
          .map(summarize),
        membership:
          lobby && current
            ? {
                ...summarize(lobby),
                state: current.leaving ? 'leaving' : ready(lobby.id) ? 'ready' : 'preparing',
                members: members(lobby.id)
                  .filter(({ leaving }) => !leaving)
                  .map(({ username }) => username),
              }
            : null,
      };
    },
    async create(userId: number, name: string, password: string) {
      requireOnline();
      requireNoMembership(userId);
      const passwordHash = password ? await hash(password) : null;
      db.transaction(() => {
        requireOnline();
        requireNoMembership(userId);
        if (db.select({ id: lobbies.id }).from(lobbies).all().length >= maxLobbies)
          throw new LobbyError(409, 'The lobby limit has been reached.');
        let code: string;
        do {
          code = randomBytes(5).toString('hex').toUpperCase();
        } while (db.select({ id: lobbies.id }).from(lobbies).where(eq(lobbies.code, code)).get());
        const id = randomUUID();
        db.insert(lobbies).values({ id, name, code, passwordHash }).run();
        db.insert(lobbyMembers).values({ userId, lobbyId: id }).run();
      });
      await sync();
    },
    async join(userId: number, code: string, password: string) {
      requireOnline();
      requireNoMembership(userId);
      const lobby =
        lobbyCodePattern.test(code) &&
        db
          .select()
          .from(lobbies)
          .where(and(eq(lobbies.code, code), visible()))
          .get();
      if (!lobby) throw new LobbyError(404, 'Lobby not found.');
      if (lobby.passwordHash && !(await verify(lobby.passwordHash, password)))
        throw new LobbyError(403, 'The lobby password is incorrect.');
      db.transaction(() => {
        requireOnline();
        requireNoMembership(userId);
        if (
          !db
            .select()
            .from(lobbies)
            .where(and(eq(lobbies.id, lobby.id), visible()))
            .get()
        )
          throw new LobbyError(404, 'Lobby not found.');
        if (members(lobby.id).length >= maxLobbyMembers)
          throw new LobbyError(409, 'This lobby is full.');
        db.update(lobbies).set({ expiresAt: null }).where(eq(lobbies.id, lobby.id)).run();
        db.insert(lobbyMembers).values({ userId, lobbyId: lobby.id }).run();
      });
      await sync();
    },
    async leave(userId: number) {
      db.transaction(() => {
        const current = membership(userId);
        if (!current || current.leaving) return;
        db.update(lobbyMembers).set({ leaving: true }).where(eq(lobbyMembers.userId, userId)).run();
        if (members(current.lobbyId).every(({ leaving }) => leaving)) {
          db.update(lobbies)
            .set({ expiresAt: now() + emptyGraceMs })
            .where(eq(lobbies.id, current.lobbyId))
            .run();
        }
      });
      await sync();
    },
    launch(userId: number) {
      const current = membership(userId);
      if (!current) return undefined;
      if (
        current.leaving ||
        !ready(current.lobbyId) ||
        !desired?.lobbies.some(
          ({ id, profiles }) => id === current.lobbyId && profiles.includes(`user-${userId}`),
        )
      )
        return null;
      return current.lobbyId;
    },
  };
}

export type LobbyService = ReturnType<typeof createLobbyService>;
