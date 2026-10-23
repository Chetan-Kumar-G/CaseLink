import { Router } from 'express';
import { z } from 'zod';
import { Case } from '../models/Case.js';
import { OverlapLink } from '../models/OverlapLink.js';
import {
  BUREAU_CODES,
  CATEGORY_CODES,
  OPEN_STATUSES,
  STATUS_CODES,
  TRANSITIONS,
} from '../config/domain.js';
import { authorize } from '../middleware/auth.js';
import { canEditCase, serializeCase } from '../services/access.js';
import { audit } from '../services/audit.js';
import { detectOverlaps } from '../services/overlapEngine.js';
import { reviewResponse } from '../services/closureGuard.js';
import { caseInputSchema, createCase, notifyInstitution, recordResponse, responseInputSchema } from '../services/caseService.js';
import { createEntries } from '../services/promiseLedger.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { PROMISES } from '../config/domain.js';
import { serializeOverlap } from './overlaps.js';
import { HttpError, asyncHandler, escapeRegex, pageParams } from '../utils/http.js';

const router = Router();
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const filter = {};
    if (BUREAU_CODES.includes(req.query.bureau)) filter.bureau = req.query.bureau;
    if (STATUS_CODES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.status === 'open') filter.status = { $in: OPEN_STATUSES };
    if (CATEGORY_CODES.includes(req.query.category)) filter.category = req.query.category;
    if (req.query.overdue === 'true') {
      filter.status = { $in: OPEN_STATUSES };
      filter.dueDate = { $lt: new Date() };
    }
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ caseRef: rx }, { subject: rx }, { permanentId: rx }];
    }

    const [items, total] = await Promise.all([
      Case.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('institution', 'name permanentId city state'),
      Case.countDocuments(filter),
    ]);
    res.json({ total, page, limit, cases: items.map((c) => serializeCase(c, req.user)) });
  }),
);

router.post(
  '/',
  authorize('officer', 'bureau_head', 'admin'),
  asyncHandler(async (req, res) => {
    const input = caseInputSchema.parse(req.body);
    const bureau = req.user.role === 'admin' ? input.bureau : req.user.bureau;
    if (!bureau) throw new HttpError(400, 'Select the bureau registering this case');
    const { created, institution } = await createCase(input, { bureau, actor: req.user });
    const caseRef = created.caseRef;

    await audit(req, 'case.create', {
      entityType: 'case',
      entityId: created._id,
      summary: `Registered ${caseRef} for ${institution.permanentId}`,
      meta: { bureau, category: input.category },
    });

    const { overlaps, semantic } = await detectOverlaps(created._id);
    const populated = await OverlapLink.find({ _id: { $in: overlaps.map((o) => o._id) } }).populate('caseA caseB');

    res.status(201).json({
      case: serializeCase(created, req.user),
      overlaps: populated.map((o) => serializeOverlap(o, req.user)),
      semantic,
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const found = await Case.findById(req.params.id).populate('institution', 'name permanentId city state type');
    if (!found) throw new HttpError(404, 'Case not found');
    const overlaps = await OverlapLink.find({ $or: [{ caseA: found._id }, { caseB: found._id }] })
      .sort({ score: -1 })
      .populate('caseA caseB');

    await audit(req, 'case.view', { entityType: 'case', entityId: found._id, summary: `Viewed ${found.caseRef}` });
    const ledger = await LedgerEntry.find({ case: found._id }, { 'checkIn.token': 0, complainantHash: 0 }).sort({ dueDate: 1 }).lean();

    res.json({
      case: viewCase(found, req.user),
      overlaps: overlaps.map((o) => serializeOverlap(o, req.user)),
      ledger,
      promiseDefaults: { vagueDefaultDays: PROMISES.vagueDefaultDays },
    });
  }),
);

const statusSchema = z.object({
  status: z.enum(STATUS_CODES),
  note: z.string().trim().min(5, 'Add a short note explaining the change').max(2000),
});

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status, note } = statusSchema.parse(req.body);
    const found = await Case.findById(req.params.id);
    if (!found) throw new HttpError(404, 'Case not found');
    if (!canEditCase(req.user, found)) throw new HttpError(403, 'Only the owning bureau can update this case');
    if (status === 'resolved' || status === 'resolved_on_promise') {
      throw new HttpError(409, 'Cases are resolved through ClosureGuard: record the institution’s response and accept it');
    }
    if (!manualTransitions(found.status).includes(status)) {
      throw new HttpError(409, `A case cannot move from "${found.status}" to "${status}"`);
    }
    const from = found.status;
    found.status = status;
    if (status === 'closed') found.closedAt = new Date();
    found.history.push({ by: req.user._id, byName: req.user.name, action: 'status_changed', note, from, to: status });
    await found.save();

    await audit(req, 'case.status_change', {
      entityType: 'case',
      entityId: found._id,
      summary: `${found.caseRef}: ${from} → ${status}`,
      meta: { from, to: status, note },
    });
    if (status === 'awaiting_institution') {
      await notifyInstitution(found, { title: `Action needed on ${found.caseRef}`, body: note });
    }
    res.json({ case: viewCase(found, req.user) });
  }),
);

const noteSchema = z.object({ note: z.string().trim().min(3).max(2000) });

router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const { note } = noteSchema.parse(req.body);
    const found = await Case.findById(req.params.id);
    if (!found) throw new HttpError(404, 'Case not found');
    if (!canEditCase(req.user, found)) throw new HttpError(403, 'Only the owning bureau can add notes to this case');
    found.history.push({ by: req.user._id, byName: req.user.name, action: 'note', note });
    await found.save();
    await audit(req, 'case.note', { entityType: 'case', entityId: found._id, summary: `Note added to ${found.caseRef}` });
    res.status(201).json({ history: found.history });
  }),
);

// ---- ClosureGuard -----------------------------------------------------------

const viewCase = (doc, user) => ({
  ...serializeCase(doc, user),
  canEdit: canEditCase(user, doc),
  allowedTransitions: manualTransitions(doc.status),
});

// "Resolved" is reachable only through a ClosureGuard decision.
const manualTransitions = (status) => (TRANSITIONS[status] || []).filter((s) => !['resolved', 'resolved_on_promise'].includes(s));

async function loadEditableCase(req) {
  const found = await Case.findById(req.params.id).populate('institution', 'name permanentId city state type');
  if (!found) throw new HttpError(404, 'Case not found');
  if (!canEditCase(req.user, found)) throw new HttpError(403, 'Only the owning bureau can do this');
  return found;
}

router.post(
  '/:id/responses',
  asyncHandler(async (req, res) => {
    const input = responseInputSchema.parse(req.body);
    const found = await loadEditableCase(req);
    const response = await recordResponse(found, input, req.user);

    await audit(req, 'case.response', {
      entityType: 'case',
      entityId: found._id,
      summary: `Response recorded on ${found.caseRef}`,
      meta: { summary: response.review.summary, recommendation: response.review.recommendation },
    });
    res.status(201).json({ case: viewCase(found, req.user) });
  }),
);

router.post(
  '/:id/responses/:rid/review',
  asyncHandler(async (req, res) => {
    const found = await loadEditableCase(req);
    const response = found.responses.id(req.params.rid);
    if (!response) throw new HttpError(404, 'Response not found');
    if (response.decision?.outcome) throw new HttpError(409, 'This response has already been decided');
    response.review = await reviewResponse(found, response);
    await found.save();
    await audit(req, 'closure.review', { entityType: 'case', entityId: found._id, summary: `ClosureGuard re-run on ${found.caseRef}` });
    res.json({ case: viewCase(found, req.user) });
  }),
);

const decisionSchema = z.object({
  outcome: z.enum(['accept', 'accept_on_promise', 'request_more']),
  reason: z.string().trim().min(10, 'Give a reason of at least 10 characters').max(2000),
  // For accept_on_promise: which extracted promises go into the ledger, and when to check.
  promises: z
    .array(z.object({ id: z.string().max(10), dueDate: z.coerce.date() }))
    .max(20)
    .default([]),
  overrides: z
    .array(z.object({ concernId: z.string().max(10), status: z.enum(['addressed', 'partial', 'not_addressed']) }))
    .max(50)
    .default([]),
});

router.post(
  '/:id/responses/:rid/decision',
  asyncHandler(async (req, res) => {
    const { outcome, reason, overrides, promises } = decisionSchema.parse(req.body);
    const found = await loadEditableCase(req);
    const response = found.responses.id(req.params.rid);
    if (!response) throw new HttpError(404, 'Response not found');
    if (response.decision?.outcome) throw new HttpError(409, 'A decision has already been recorded for this response');
    if (response._id.toString() !== found.responses.at(-1)._id.toString()) throw new HttpError(409, 'Only the latest response can be decided');
    if (!OPEN_STATUSES.includes(found.status)) throw new HttpError(409, 'This case is no longer open');

    const overrideById = new Map(overrides.map((o) => [o.concernId, o.status]));
    const concerns = response.review?.concerns || [];
    const finalStatus = (c) => overrideById.get(c.id) || c.status;
    const openConcerns = concerns.filter((c) => finalStatus(c) !== 'addressed').length + (response.review?.inconsistencies?.length || 0);

    // Accepting despite gaps (or without any review) needs a fuller justification.
    if (outcome === 'accept' && (openConcerns > 0 || !concerns.length) && reason.length < 30) {
      throw new HttpError(400, 'Please check the highlighted fields', {
        fields: { reason: `Explain in at least 30 characters why you are accepting${openConcerns ? ` with ${openConcerns} open item${openConcerns > 1 ? 's' : ''}` : ' without a ClosureGuard review'}` },
      });
    }

    if (outcome === 'accept_on_promise') {
      const known = new Set((response.review?.promises || []).map((p) => p.id));
      if (!promises.length || promises.some((p) => !known.has(p.id))) {
        throw new HttpError(400, 'Choose at least one of the promises ClosureGuard found to track in the ledger');
      }
      if (promises.some((p) => p.dueDate < new Date(Date.now() - 86_400_000))) {
        throw new HttpError(400, 'Promise check dates must be today or later');
      }
    }

    response.decision = {
      outcome,
      reason,
      openConcerns,
      overrides: overrides.filter((o) => concerns.some((c) => c.id === o.concernId && c.status !== o.status)),
      by: req.user._id,
      byName: req.user.name,
      at: new Date(),
    };
    const from = found.status;
    found.status = { accept: 'resolved', accept_on_promise: 'resolved_on_promise', request_more: 'awaiting_institution' }[outcome];
    found.history.push({
      by: req.user._id,
      byName: req.user.name,
      action: { accept: 'closure_accepted', accept_on_promise: 'resolved_on_promise', request_more: 'closure_more_requested' }[outcome],
      note:
        outcome === 'accept_on_promise'
          ? `${reason} — ${promises.length} promise${promises.length > 1 ? 's' : ''} added to the ledger; the complainant will be asked to confirm on the due date.`
          : reason,
      ...(from !== found.status ? { from, to: found.status } : {}),
    });
    await found.save();

    if (outcome === 'accept_on_promise') await createEntries(found, response, promises, req.user);

    await audit(req, 'closure.decision', {
      entityType: 'case',
      entityId: found._id,
      summary: `${{ accept: 'Resolution accepted', accept_on_promise: 'Resolved on promise', request_more: 'More action requested' }[outcome]} on ${found.caseRef}${openConcerns ? ` (${openConcerns} open item${openConcerns > 1 ? 's' : ''})` : ''}`,
      meta: { outcome, reason, openConcerns, overrides: response.decision.overrides, promises: promises.length || undefined },
    });
    if (outcome === 'request_more') {
      await notifyInstitution(found, { title: `Further action requested on ${found.caseRef}`, body: reason });
    }
    res.json({ case: viewCase(found, req.user) });
  }),
);

// Re-run overlap detection, e.g. after the AI service was unavailable.
router.post(
  '/:id/rescan',
  asyncHandler(async (req, res) => {
    const found = await Case.findById(req.params.id);
    if (!found) throw new HttpError(404, 'Case not found');
    const { overlaps, semantic } = await detectOverlaps(found._id);
    await audit(req, 'case.rescan', { entityType: 'case', entityId: found._id, summary: `Re-ran overlap detection for ${found.caseRef}`, meta: { found: overlaps.length, semantic: semantic.ran } });
    const populated = await OverlapLink.find({ _id: { $in: overlaps.map((o) => o._id) } }).populate('caseA caseB');
    res.json({ overlaps: populated.map((o) => serializeOverlap(o, req.user)), semantic });
  }),
);

export default router;
