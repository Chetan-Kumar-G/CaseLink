import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { authorize } from '../middleware/auth.js';
import { audit, verifyChain } from '../services/audit.js';
import { asyncHandler, escapeRegex, pageParams } from '../utils/http.js';

const router = Router();

router.use(authorize('senior_reviewer', 'admin', 'bureau_head'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, { defaultLimit: 25 });
    const filter = {};
    // Bureau heads see activity by their own bureau's staff only.
    if (req.user.role === 'bureau_head') filter.actorBureau = req.user.bureau;
    const action = String(req.query.action || '').trim();
    if (/^[a-z_.]{2,40}$/.test(action)) filter.action = new RegExp(`^${escapeRegex(action)}`);
    if (req.query.entityId && /^[a-f0-9]{24}$/.test(req.query.entityId)) filter.entityId = req.query.entityId;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ seq: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ total, page, limit, entries });
  }),
);

router.get(
  '/verify',
  authorize('senior_reviewer', 'admin'),
  asyncHandler(async (req, res) => {
    const result = await verifyChain();
    await audit(req, 'audit.verify', { summary: result.valid ? `Chain verified (${result.count} entries)` : `Chain broken at #${result.brokenAt}` });
    res.json({ ...result, checkedAt: new Date() });
  }),
);

export default router;
