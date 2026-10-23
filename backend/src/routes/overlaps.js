import { Router } from 'express';
import { z } from 'zod';
import { OverlapLink } from '../models/OverlapLink.js';
import { Case } from '../models/Case.js';
import { canDecideOverlap, isGlobalRole, serializeCase } from '../services/access.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notify.js';
import { HttpError, asyncHandler, pageParams } from '../utils/http.js';

const router = Router();

export function serializeOverlap(o, user) {
  const obj = o.toObject();
  return {
    ...obj,
    id: obj._id.toString(),
    caseA: serializeCase(o.caseA, user),
    caseB: serializeCase(o.caseB, user),
    canDecide: o.status === 'pending' && canDecideOverlap(user, o),
  };
}

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const scope = isGlobalRole(req.user) ? {} : { bureaus: req.user.bureau };
    const [pending, crossBureau] = await Promise.all([
      OverlapLink.countDocuments({ ...scope, status: 'pending' }),
      OverlapLink.countDocuments({ ...scope, status: 'pending', crossBureau: true }),
    ]);
    res.json({ pending, crossBureau });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const filter = {};
    const status = String(req.query.status || 'pending');
    if (['pending', 'linked', 'dismissed', 'coordination_requested'].includes(status)) filter.status = status;
    if (req.query.crossBureau === 'true') filter.crossBureau = true;
    if (req.query.mine === 'true' && req.user.bureau) filter.bureaus = req.user.bureau;

    const [items, total] = await Promise.all([
      OverlapLink.find(filter).sort({ crossBureau: -1, score: -1, createdAt: -1 }).skip(skip).limit(limit).populate('caseA caseB institution'),
      OverlapLink.countDocuments(filter),
    ]);
    res.json({
      total,
      page,
      limit,
      overlaps: items.map((o) => ({
        ...serializeOverlap(o, req.user),
        institution: o.institution && { id: o.institution._id.toString(), name: o.institution.name, permanentId: o.institution.permanentId },
      })),
    });
  }),
);

const decisionSchema = z.object({
  action: z.enum(['link', 'dismiss', 'coordinate']),
  reason: z.string().trim().min(10, 'Please give a reason of at least 10 characters').max(1000),
});

const STATUS_FOR = { link: 'linked', dismiss: 'dismissed', coordinate: 'coordination_requested' };
const HISTORY_ACTION = { link: 'overlap_linked', dismiss: 'overlap_dismissed', coordinate: 'coordination_requested' };

// Human decision on a detected overlap. Cases are never merged automatically.
router.post(
  '/:id/decision',
  asyncHandler(async (req, res) => {
    const { action, reason } = decisionSchema.parse(req.body);
    const overlap = await OverlapLink.findById(req.params.id).populate('caseA caseB');
    if (!overlap) throw new HttpError(404, 'Overlap not found');
    if (overlap.status !== 'pending') throw new HttpError(409, 'A decision has already been recorded for this overlap');
    if (!canDecideOverlap(req.user, overlap)) {
      throw new HttpError(403, 'Only officers of the bureaus involved, or senior reviewers, can decide this overlap');
    }

    overlap.status = STATUS_FOR[action];
    overlap.decision = { by: req.user._id, byName: req.user.name, byBureau: req.user.bureau, at: new Date(), reason };
    await overlap.save();

    const pairLabel = `${overlap.caseA.caseRef} ↔ ${overlap.caseB.caseRef}`;
    for (const [self, other] of [
      [overlap.caseA, overlap.caseB],
      [overlap.caseB, overlap.caseA],
    ]) {
      const entry = {
        at: new Date(),
        by: req.user._id,
        byName: req.user.name,
        action: HISTORY_ACTION[action],
        note: `${action === 'coordinate' ? `Coordination requested with ${other.bureau}` : action === 'link' ? 'Linked with' : 'Overlap dismissed with'} ${other.caseRef}: ${reason}`,
      };
      const update = { $push: { history: entry } };
      // Coordination moves the counterpart bureau's open case into "coordination".
      if (action === 'coordinate' && self.bureau !== req.user.bureau && ['registered', 'under_review', 'awaiting_institution'].includes(self.status)) {
        update.$set = { status: 'coordination' };
        entry.from = self.status;
        entry.to = 'coordination';
      }
      await Case.updateOne({ _id: self._id }, update);
    }

    await audit(req, `overlap.${action}`, {
      entityType: 'overlap',
      entityId: overlap._id,
      summary: `${STATUS_FOR[action].replace('_', ' ')}: ${pairLabel}`,
      meta: { reason, caseA: overlap.caseA.caseRef, caseB: overlap.caseB.caseRef },
    });

    if (action === 'coordinate') {
      const otherBureaus = overlap.bureaus.filter((b) => b !== req.user.bureau);
      await notify(
        { roles: ['officer', 'bureau_head'], bureaus: otherBureaus.length ? otherBureaus : overlap.bureaus, exclude: req.user._id },
        {
          type: 'coordination',
          title: `Coordination requested by ${req.user.bureau || 'senior reviewer'}: ${pairLabel}`,
          body: reason,
          link: `/cases/${overlap.caseA._id}`,
        },
      );
    }

    const fresh = await OverlapLink.findById(overlap._id).populate('caseA caseB');
    res.json({ overlap: serializeOverlap(fresh, req.user) });
  }),
);

export default router;
