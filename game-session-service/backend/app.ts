import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { hash, verify } from '@node-rs/argon2';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { Account } from './accounts.ts';
import { sessionLifetime, SQLiteSessionStore } from './session-store.ts';

declare global {
  namespace Express {
    interface User extends Account {}
  }
}

interface AppOptions {
  sessionSecret: string;
  origins: ReadonlySet<string>;
  secureCookies: boolean;
}

const cookieName = 'game_session';
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

export async function createApp(database: DatabaseSync, options: AppOptions) {
  const app = express();
  const passport = new Passport();
  const missingAccountHash = await hash(randomBytes(32));
  const accountByUsername = database.prepare(
    'SELECT id, username, role, password_hash FROM users WHERE username = ?',
  );
  const accountById = database.prepare('SELECT id, username, role FROM users WHERE id = ?');

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const account = accountByUsername.get(username) as
          (Account & { password_hash: string }) | undefined;
        const valid = await verify(account?.password_hash ?? missingAccountHash, password);
        if (!account || !valid) return done(null, false);
        done(null, { id: account.id, username: account.username, role: account.role });
      } catch (error) {
        done(error);
      }
    }),
  );
  passport.serializeUser((account: Express.User, done) => done(null, account.id));
  passport.deserializeUser((id: number, done) => {
    try {
      done(null, (accountById.get(id) as Account | undefined) ?? false);
    } catch (error) {
      done(error);
    }
  });

  app.disable('x-powered-by');
  if (options.secureCookies) app.set('trust proxy', 'loopback');
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

  app.use(
    '/api',
    express.json({ limit: '8kb' }),
    session({
      name: cookieName,
      secret: options.sessionSecret,
      store: new SQLiteSessionStore(database),
      saveUninitialized: false,
      resave: false,
      cookie: { ...cookieOptions, secure: options.secureCookies, maxAge: sessionLifetime },
    }),
    passport.initialize(),
    passport.session(),
  );

  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  });

  app.post(['/api/sign-in', '/api/admin/sign-in'], loginLimit, (request, response, next) => {
    const { username, password } = request.body ?? {};
    if (
      !request.is('application/json') ||
      typeof username !== 'string' ||
      username.length > 32 ||
      typeof password !== 'string' ||
      password.length > 128 ||
      !username ||
      !password
    ) {
      response.status(400).json({ error: 'Enter a username and password.' });
      return;
    }

    const adminOnly = request.path === '/api/admin/sign-in';
    passport.authenticate('local', (error: unknown, account: Account | false) => {
      if (error) return next(error);
      if (!account || (adminOnly && account.role !== 'admin')) {
        response.status(401).json({ error: 'Invalid username or password.' });
        return;
      }
      request.logIn(account, (loginError) => {
        if (loginError) return next(loginError);
        response.json({ user: account });
      });
    })(request, response, next);
  });

  app.get(['/api/session', '/api/admin/session'], (request, response) => {
    if (!request.user) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    if (request.path === '/api/admin/session' && request.user.role !== 'admin') {
      response.status(403).json({ error: 'Sign in with an administrator account.' });
      return;
    }
    response.json({ user: request.user });
  });

  app.post('/api/sign-out', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie(cookieName, { ...cookieOptions, secure: options.secureCookies });
      response.sendStatus(204);
    });
  });

  app.use('/api', (_request, response) => response.status(404).json({ error: 'Route not found.' }));
  const handleError: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) return next(error);
    if (error.status === 400 || error.status === 413) {
      response.status(error.status).json({ error: 'Invalid request body.' });
      return;
    }
    console.error(error);
    response.status(500).json({ error: 'The server could not complete the request.' });
  };
  app.use(handleError);
  return app;
}
