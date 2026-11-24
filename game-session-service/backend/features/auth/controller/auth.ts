import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { AuthDatabase } from '../../../database.ts';
import { createAccountService } from '../services/accounts.ts';
import { sessionLifetime, SQLiteSessionStore } from '../services/session-store.ts';
import type { Account, SignInRequest } from '../types/account.ts';

declare global {
  namespace Express {
    interface User extends Account {}
  }
}

export interface AuthOptions {
  sessionSecret: string;
  secureCookies: boolean;
}

const cookieName = 'game_session';
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

function requireSession(adminOnly: boolean): RequestHandler {
  return (request, response, next) => {
    if (!request.user) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }
    if (adminOnly && request.user.role !== 'admin') {
      response.status(403).json({ error: 'Sign in with an administrator account.' });
      return;
    }
    next();
  };
}

export const requireUserSession = requireSession(false);
export const requireAdminSession = requireSession(true);

const sendSession: RequestHandler = (request, response) => {
  response.json({ user: request.user });
};

export async function createAuthRouter(database: AuthDatabase, options: AuthOptions) {
  const router = express.Router();
  const passport = new Passport();
  const accounts = await createAccountService(database);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const account = await accounts.verifyCredentials({ username, password });
        done(null, account ?? false);
      } catch (error) {
        done(error);
      }
    }),
  );
  passport.serializeUser((account: Express.User, done) => done(null, account.id));
  passport.deserializeUser((id: number, done) => {
    try {
      done(null, accounts.findById(id) ?? false);
    } catch (error) {
      done(error);
    }
  });

  router.use(
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

  function signIn(adminOnly: boolean): RequestHandler {
    return (request, response, next) => {
      const body: Partial<Record<keyof SignInRequest, unknown>> | undefined = request.body;
      const { username, password } = body ?? {};
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
    };
  }

  router.post('/sign-in', loginLimit, signIn(false));
  router.post('/admin/sign-in', loginLimit, signIn(true));
  router.get('/session', requireUserSession, sendSession);
  router.get('/admin/session', requireAdminSession, sendSession);
  router.post('/sign-out', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie(cookieName, { ...cookieOptions, secure: options.secureCookies });
      response.sendStatus(204);
    });
  });

  return router;
}
