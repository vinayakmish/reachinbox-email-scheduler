import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import ConnectPgSimple from 'connect-pg-simple';
import { config } from './config';
import { prisma } from './config/prisma';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import emailRoutes from './routes/emails';
import senderRoutes from './routes/senders';
import { errorHandler } from './middleware/errorHandler';

const PgSession = ConnectPgSimple(session);

export function createApp() {
  const app = express();

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session (PostgreSQL-backed for persistence)
  app.use(
    session({
      store: new PgSession({
        conString: config.databaseUrl,
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Passport Google Strategy ──
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email in Google profile'));
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
              name: profile.displayName,
              email,
              avatarUrl: profile.photos?.[0]?.value || null,
            },
            create: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              avatarUrl: profile.photos?.[0]?.value || null,
            },
          });

          logger.info({ userId: user.id, email: user.email }, 'User authenticated via Google OAuth');
          return done(null, user);
        } catch (err) {
          logger.error({ err }, 'OAuth strategy error');
          return done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  // ── Routes ──
  app.use('/api/auth', authRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/senders', senderRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
