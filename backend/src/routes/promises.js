import { Router } from 'express';
import { LedgerEntry, PROMISE_OPEN } from '../models/LedgerEntry.js';
import { env } from '../config/env.js';
import { authorize } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { fastForward, promiseRates } from '../services/promiseLedger.js';
import { isGlobalRole } from '../services/access.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const router = Router();
const DAY = 86_400_000;
// The fast-forward control exists for demos only (development or DEMO_MODE).
const DEMO_CONTROLS = env.demoControls;

const FILTERS = {
  open: { status: { $in: PROMISE_OPEN } },
  due_soon: { status: 'pending' }, // narrowed by date below
  awaiting: { status: 'awaiting_confirmation' },
  kept: { status: { $in: ['kept', 'partly_kept'] } },
  broken: { status: 'broken' },
  all: {},
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const key = FILTERS[req.query.filter] ? req.query.filter : 'open';
    const filter = { ...FILTERS[key] };
    if (key === 'due_soon') filter.dueDate = { $lte: new Date(Date.now() + 7 * DAY) };
    if (!isGlobalRole(req.user) && req.query.mine === 'true' && req.user.bureau) filter.bureau = req.user.bureau;

    const [entries, counts, rates] = await Promise.all([
      LedgerEntry.find(filter, { 'checkIn.token': 0, complainantHash: 0 })
        .sort(key === 'kept' || key === 'broken' ? { 'checkIn.answeredAt': -1 } : { dueDate: 1 })
        .limit(200)
        .populate('institution', 'name permanentId city')
        .lean(),
      LedgerEntry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      promiseRates(),
    ]);
    const c = Object.fromEntries(counts.map((x) => [x._id, x.n]));
    const dueSoon = await LedgerEntry.countDocuments({ status: 'pending', dueDate: { $lte: new Date(Date.now() + 7 * DAY) } });
    const decided = (c.kept || 0) + (c.partly_kept || 0) + (c.broken || 0);
    const institutions = [...rates.entries()]
      .map(([id, r]) => ({ id, ...r }))
      .filter((r) => r.total);
    res.json({
      demoControls: DEMO_CONTROLS,
      stats: {
        open: (c.pending || 0) + (c.awaiting_confirmation || 0),
        awaiting: c.awaiting_confirmation || 0,
        dueSoon,
        kept: c.kept || 0,
        partly: c.partly_kept || 0,
        broken: c.broken || 0,
        unconfirmed: c.unconfirmed || 0,
        rate: decided ? Math.round((((c.kept || 0) + (c.partly_kept || 0) * 0.5) / decided) * 100) : null,
      },
      institutions,
      entries: entries.map((e) => ({ ...e, id: e._id.toString(), institution: e.institution && { id: e.institution._id.toString(), name: e.institution.name, permanentId: e.institution.permanentId } })),
    });
  }),
);

// Demo: "fast-forward" a promise to its deadline so the check-in goes out now.
router.post(
  '/:id/fast-forward',
  authorize('officer', 'bureau_head', 'senior_reviewer', 'admin'),
  asyncHandler(async (req, res) => {
    if (!DEMO_CONTROLS) throw new HttpError(404, 'Not available');
    const entry = await fastForward(req.params.id);
    if (!entry) throw new HttpError(409, 'Only promises that are still pending can be fast-forwarded');
    await audit(req, 'promise.fast_forward', { entityType: 'case', entityId: entry.case, summary: `Demo: fast-forwarded promise on ${entry.caseRef} to its deadline` });
    // The token is what the complainant's SMS/email would carry; shown here for the demo only.
    res.json({ id: entry._id.toString(), status: entry.status, checkInUrl: `/check/${entry.checkIn.token}` });
  }),
);

export default router;
