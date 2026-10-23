import { Router } from 'express';
import { Institution } from '../models/Institution.js';
import { Case } from '../models/Case.js';
import { OverlapLink } from '../models/OverlapLink.js';
import { OPEN_STATUSES } from '../config/domain.js';
import { serializeCase } from '../services/access.js';
import { serializeOverlap } from './overlaps.js';
import { audit } from '../services/audit.js';
import { promiseRates } from '../services/promiseLedger.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { HttpError, asyncHandler, escapeRegex } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const filter = q
      ? { $or: ['name', 'permanentId', 'city', 'state'].map((f) => ({ [f]: new RegExp(escapeRegex(q), 'i') })) }
      : {};
    const institutions = await Institution.find(filter).sort({ name: 1 }).limit(100).lean();
    const ids = institutions.map((i) => i._id);

    const [caseStats, overlapStats] = await Promise.all([
      Case.aggregate([
        { $match: { institution: { $in: ids } } },
        {
          $group: {
            _id: '$institution',
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
            bureaus: { $addToSet: '$bureau' },
            lastActivity: { $max: '$updatedAt' },
          },
        },
      ]),
      OverlapLink.aggregate([
        { $match: { institution: { $in: ids }, status: 'pending' } },
        { $group: { _id: '$institution', pending: { $sum: 1 } } },
      ]),
    ]);
    const statsById = new Map(caseStats.map((s) => [s._id.toString(), s]));
    const rates = await promiseRates(ids);
    const overlapById = new Map(overlapStats.map((s) => [s._id.toString(), s.pending]));

    res.json({
      institutions: institutions.map((i) => {
        const s = statsById.get(i._id.toString());
        return {
          ...i,
          id: i._id.toString(),
          stats: {
            total: s?.total || 0,
            open: s?.open || 0,
            bureaus: (s?.bureaus || []).sort(),
            lastActivity: s?.lastActivity || null,
            pendingOverlaps: overlapById.get(i._id.toString()) || 0,
          },
          promises: rates.get(i._id.toString()) || null,
        };
      }),
    });
  }),
);

// Institution 360 — every case for one AICTE Permanent ID, across all bureaus.
router.get(
  '/:permanentId',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findOne({ permanentId: String(req.params.permanentId) }).lean();
    if (!institution) throw new HttpError(404, 'No institution found with this AICTE Permanent ID');

    const [cases, overlaps, ledger, rates] = await Promise.all([
      Case.find({ institution: institution._id }).sort({ createdAt: -1 }),
      OverlapLink.find({ institution: institution._id })
        .sort({ status: 1, score: -1 })
        .populate('caseA caseB'),
      LedgerEntry.find({ institution: institution._id }, { 'checkIn.token': 0, complainantHash: 0 }).sort({ dueDate: -1 }).lean(),
      promiseRates([institution._id]),
    ]);
    // Copy-paste replies seen across this institution's cases.
    const templateReplies = cases
      .flatMap((c) => c.responses.filter((r) => r.template?.others).map((r) => ({ caseRef: c.caseRef, caseId: c._id.toString(), others: r.template.others, at: r.at })))
      .sort((a, b) => new Date(b.at) - new Date(a.at));

    const now = new Date();
    const byBureau = {};
    const byStatus = {};
    const byCategory = {};
    let open = 0;
    let overdue = 0;
    for (const c of cases) {
      byBureau[c.bureau] = byBureau[c.bureau] || { total: 0, open: 0 };
      byBureau[c.bureau].total += 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      if (OPEN_STATUSES.includes(c.status)) {
        open += 1;
        byBureau[c.bureau].open += 1;
        if (c.dueDate && c.dueDate < now) overdue += 1;
      }
    }

    const timeline = cases
      .flatMap((c) =>
        c.history.map((h) => ({
          at: h.at,
          action: h.action,
          note: h.note,
          from: h.from,
          to: h.to,
          byName: h.byName,
          caseId: c._id.toString(),
          caseRef: c.caseRef,
          bureau: c.bureau,
        })),
      )
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 60);

    await audit(req, 'institution.view', {
      entityType: 'institution',
      entityId: institution._id,
      summary: `Viewed Institution 360 for ${institution.permanentId}`,
    });

    res.json({
      institution: { ...institution, id: institution._id.toString() },
      stats: {
        total: cases.length,
        open,
        overdue,
        bureausInvolved: Object.keys(byBureau).length,
        pendingOverlaps: overlaps.filter((o) => o.status === 'pending').length,
        byBureau,
        byStatus,
        byCategory,
      },
      cases: cases.map((c) => serializeCase(c, req.user)),
      overlaps: overlaps.map((o) => serializeOverlap(o, req.user)),
      timeline,
      promises: { record: rates.get(institution._id.toString()) || null, entries: ledger, templateReplies },
    });
  }),
);

export default router;
