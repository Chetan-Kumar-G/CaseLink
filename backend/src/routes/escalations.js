import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { runEscalations } from '../services/escalation.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// Manual trigger; the scheduler also runs this every ESCALATION_INTERVAL_MIN.
router.post(
  '/run',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const summary = await runEscalations();
    await audit(req, 'escalation.run', { summary: `Escalation check: ${summary.reminders} reminder(s), ${summary.escalations} escalation(s)`, meta: summary });
    res.json(summary);
  }),
);

export default router;
