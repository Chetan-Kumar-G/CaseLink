import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { runEscalations } from '../services/escalation.js';
import { runPromiseChecks } from '../services/promiseLedger.js';
import { seedDatabase } from '../seed/seed.js';
import { HttpError, asyncHandler } from '../utils/http.js';

// Operational endpoints for serverless hosting, where there is no background
// timer: a cron tick and (demo deployments only) a data reset.
const router = Router();

const sameSecret = (given, expected) => {
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Vercel Cron calls this daily (vercel.json). It can also be called by any
// scheduler with "Authorization: Bearer <CRON_SECRET>".
router.get(
  '/cron/tick',
  asyncHandler(async (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!sameSecret(token, env.cronSecret)) throw new HttpError(401, 'Unauthorized');
    const escalations = await runEscalations();
    const promises = await runPromiseChecks();
    res.json({ ok: true, escalations, promises, at: new Date() });
  }),
);

// DEMO_MODE only: wipe and re-seed the synthetic demo data (e.g. before judging).
router.post(
  '/demo/reset',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }),
  asyncHandler(async (req, res) => {
    if (!env.demoMode || !env.demoResetToken) throw new HttpError(404, 'Resource not found');
    if (!sameSecret(req.headers['x-demo-token'], env.demoResetToken)) throw new HttpError(401, 'Unauthorized');
    const lines = [];
    await seedDatabase({ waitForAiSeconds: 5, log: (l) => lines.push(l) });
    res.json({ ok: true, log: lines });
  }),
);

export default router;
