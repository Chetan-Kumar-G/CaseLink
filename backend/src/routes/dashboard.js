import { Router } from 'express';
import { Case } from '../models/Case.js';
import { OverlapLink } from '../models/OverlapLink.js';
import { AuditLog } from '../models/AuditLog.js';
import { Institution } from '../models/Institution.js';
import { OPEN_STATUSES, STATUSES } from '../config/domain.js';
import { isGlobalRole } from '../services/access.js';
import { aiHealth } from '../services/aiClient.js';
import { asyncHandler } from '../utils/http.js';
import { LedgerEntry } from '../models/LedgerEntry.js';

const router = Router();
const DAY = 86_400_000;
const WEEKS = 12;

// Monday 00:00 of the week containing d.
function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const open = { status: { $in: OPEN_STATUSES } };
    const overlapScope = isGlobalRole(req.user) ? {} : { bureaus: req.user.bureau };

    const [total, openCount, overdue, institutions, byBureau, byCategory, pendingOverlaps, crossBureauPending, hotspots, recent, ai] =
      await Promise.all([
        Case.countDocuments(),
        Case.countDocuments(open),
        Case.countDocuments({ ...open, dueDate: { $lt: now } }),
        Institution.countDocuments(),
        Case.aggregate([
          { $group: { _id: '$bureau', total: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } } } },
          { $sort: { _id: 1 } },
        ]),
        Case.aggregate([{ $group: { _id: '$category', total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
        OverlapLink.countDocuments({ ...overlapScope, status: 'pending' }),
        OverlapLink.countDocuments({ ...overlapScope, status: 'pending', crossBureau: true }),
        // Institutions with open cases in more than one bureau — the core coordination signal.
        Case.aggregate([
          { $match: open },
          { $group: { _id: '$institution', open: { $sum: 1 }, bureaus: { $addToSet: '$bureau' } } },
          { $match: { 'bureaus.1': { $exists: true } } },
          { $sort: { open: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'institutions', localField: '_id', foreignField: '_id', as: 'inst' } },
          { $unwind: '$inst' },
          { $project: { _id: 0, open: 1, bureaus: 1, name: '$inst.name', permanentId: '$inst.permanentId', city: '$inst.city' } },
        ]),
        AuditLog.find(isGlobalRole(req.user) ? {} : { $or: [{ actor: req.user._id }, { actorRole: 'system' }] })
          .sort({ seq: -1 })
          .limit(8)
          .lean(),
        aiHealth(),
      ]);

    // --- Visual sections -----------------------------------------------------
    const firstWeek = new Date(weekStart(now).getTime() - (WEEKS - 1) * 7 * DAY);
    const [weeklyRaw, byStatus, flowRaw, crossByInst, dueSoon] = await Promise.all([
      // New complaints per week.
      Case.aggregate([
        { $match: { createdAt: { $gte: firstWeek } } },
        { $project: { w: { $floor: { $divide: [{ $subtract: ['$createdAt', firstWeek] }, 7 * DAY] } } } },
        { $group: { _id: '$w', count: { $sum: 1 } } },
      ]),
      Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      // Open cases per bureau for the institutions with the most open cases.
      Case.aggregate([
        { $match: open },
        { $group: { _id: { institution: '$institution', bureau: '$bureau' }, open: { $sum: 1 } } },
        { $group: { _id: '$_id.institution', total: { $sum: '$open' }, links: { $push: { bureau: '$_id.bureau', open: '$open' } } } },
        { $sort: { total: -1 } },
        { $limit: 6 },
        { $lookup: { from: 'institutions', localField: '_id', foreignField: '_id', as: 'inst' } },
        { $unwind: '$inst' },
      ]),
      OverlapLink.aggregate([
        { $match: { status: 'pending', crossBureau: true } },
        { $group: { _id: '$institution', count: { $sum: 1 } } },
      ]),
      Case.countDocuments({ ...open, dueDate: { $gte: now, $lt: new Date(now.getTime() + 3 * DAY) } }),
    ]);

    const ledgerCounts = Object.fromEntries((await LedgerEntry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));
    const decidedPromises = (ledgerCounts.kept || 0) + (ledgerCounts.partly_kept || 0) + (ledgerCounts.broken || 0);
    const nextDue = await LedgerEntry.find({ status: 'pending' }, { caseRef: 1, action: 1, dueDate: 1, amount: 1, institution: 1 })
      .sort({ dueDate: 1 })
      .limit(3)
      .populate('institution', 'name permanentId')
      .lean();
    const weekCounts = new Map(weeklyRaw.map((w) => [w._id, w.count]));
    const weekly = Array.from({ length: WEEKS }, (_, i) => ({
      week: new Date(firstWeek.getTime() + i * 7 * DAY),
      count: weekCounts.get(i) || 0,
    }));
    const statusCounts = new Map(byStatus.map((s) => [s._id, s.count]));
    const crossMap = new Map(crossByInst.map((c) => [c._id.toString(), c.count]));
    const flows = flowRaw.map((f) => ({
      institution: { id: f._id.toString(), name: f.inst.name, permanentId: f.inst.permanentId, city: f.inst.city },
      total: f.total,
      crossBureauPending: crossMap.get(f._id.toString()) || 0,
      links: f.links.sort((a, b) => a.bureau.localeCompare(b.bureau)),
    }));

    res.json({
      totals: { cases: total, open: openCount, overdue, institutions, pendingOverlaps, crossBureauPending },
      byBureau: byBureau.map((b) => ({ bureau: b._id, total: b.total, open: b.open })),
      byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
      hotspots,
      weekly,
      pipeline: STATUSES.map((s) => ({ status: s.code, label: s.label, count: statusCounts.get(s.code) || 0 })),
      flows,
      deadline: { onTime: openCount - overdue - dueSoon, dueSoon, overdue },
      promises: {
        open: (ledgerCounts.pending || 0) + (ledgerCounts.awaiting_confirmation || 0),
        awaiting: ledgerCounts.awaiting_confirmation || 0,
        kept: ledgerCounts.kept || 0,
        partly: ledgerCounts.partly_kept || 0,
        broken: ledgerCounts.broken || 0,
        rate: decidedPromises ? Math.round((((ledgerCounts.kept || 0) + (ledgerCounts.partly_kept || 0) * 0.5) / decidedPromises) * 100) : null,
        nextDue: nextDue.map((n) => ({ id: n._id.toString(), caseRef: n.caseRef, action: n.action, amount: n.amount, dueDate: n.dueDate, institution: n.institution?.name, permanentId: n.institution?.permanentId })),
      },
      recent: recent.map((r) => ({ seq: r.seq, at: r.at, actorName: r.actorName, action: r.action, summary: r.summary })),
      ai: { reachable: ai.reachable, mode: ai.mode || null, model: ai.model || null },
    });
  }),
);

export default router;
