import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { authenticate, authorize } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { aiHealth } from './services/aiClient.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import institutionRoutes from './routes/institutions.js';
import caseRoutes from './routes/cases.js';
import overlapRoutes from './routes/overlaps.js';
import auditRoutes from './routes/audit.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import watchlistRoutes from './routes/watchlist.js';
import portalRoutes from './routes/portal.js';
import importRoutes from './routes/import.js';
import escalationRoutes from './routes/escalations.js';
import promiseRoutes from './routes/promises.js';
import checkinRoutes from './routes/checkin.js';
import opsRoutes from './routes/ops.js';
import { STAFF_ROLES } from './config/domain.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      // Tight CSP for the single-page app: own origin, Google Fonts, inline
      // styles (framer-motion animates via style attributes), nothing else.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      strictTransportSecurity: env.isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use('/api', cors({ origin: env.clientOrigins, credentials: true }));
  app.use('/api/import', express.json({ limit: '2mb' })); // bulk imports only
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  if (env.logFormat !== 'none') app.use(morgan(env.logFormat));

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests, please slow down' } }),
  );

  // Liveness: the process is up. Readiness: it can serve traffic (database connected).
  app.get('/api/health', async (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1, ai: await aiHealth() });
  });
  app.get('/api/ready', (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ready });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/meta', metaRoutes);
  // Staff areas are closed to institution portal accounts.
  const staff = [authenticate, authorize(...STAFF_ROLES)];
  app.use('/api/institutions', staff, institutionRoutes);
  app.use('/api/cases', staff, caseRoutes);
  app.use('/api/overlaps', staff, overlapRoutes);
  app.use('/api/audit', staff, auditRoutes);
  app.use('/api/dashboard', staff, dashboardRoutes);
  app.use('/api/watchlist', staff, watchlistRoutes);
  app.use('/api/import', staff, importRoutes);
  app.use('/api/escalations', staff, escalationRoutes);
  app.use('/api/promises', staff, promiseRoutes);
  app.use('/api/checkin', checkinRoutes); // public, token-based (complainant)
  app.use('/api/notifications', authenticate, notificationRoutes);
  app.use('/api/portal', authenticate, authorize('institution'), portalRoutes);

  app.use('/api', opsRoutes); // cron tick + demo reset (secret-protected)
  app.use('/api', notFound);

  // Single-origin deployment: serve the built frontend and fall back to
  // index.html for client-side routes.
  if (env.serveWeb) {
    const index = path.join(env.webDist, 'index.html');
    if (!fs.existsSync(index)) throw new Error(`SERVE_WEB is on but ${index} was not found — run "npm run build" in frontend/ first`);
    app.use(
      express.static(env.webDist, {
        index: false,
        setHeaders: (res, file) => {
          // Hashed assets never change; HTML must always be revalidated.
          res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  }

  app.use(errorHandler);
  return app;
}
