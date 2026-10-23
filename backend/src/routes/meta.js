import { Router } from 'express';
import { env } from '../config/env.js';
import { users as demoUsers } from '../seed/data.js';
import { BUREAUS, CATEGORIES, CHANNELS, ESCALATION, PRIORITIES, ROLES, STATUSES, TRANSITIONS, WATCHLIST } from '../config/domain.js';

const router = Router();

// Demo accounts are advertised only in development or a DEMO_MODE deployment
// (synthetic data). A real production deployment returns null.
function demoInfo() {
  if (env.isProd && !env.demoMode) return null;
  return {
    password: env.seedPassword,
    accounts: demoUsers.map((u) => ({ email: u.email, role: u.role, bureau: u.bureau || null, name: u.name })),
    controls: env.demoControls,
  };
}

router.get('/', (_req, res) => {
  res.json({ bureaus: BUREAUS, categories: CATEGORIES, channels: CHANNELS, statuses: STATUSES, transitions: TRANSITIONS, priorities: PRIORITIES, roles: ROLES, escalation: ESCALATION, watchlist: WATCHLIST, demo: demoInfo() });
});

export default router;
