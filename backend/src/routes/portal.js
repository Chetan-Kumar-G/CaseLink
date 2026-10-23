import { Router } from 'express';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { OPEN_STATUSES } from '../config/domain.js';
import { audit } from '../services/audit.js';
import { recordResponse, responseInputSchema } from '../services/caseService.js';
import { notify } from '../services/notify.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { HttpError, asyncHandler } from '../utils/http.js';

// Institution-side portal. Institution users see only their own institution's
// cases, never complainant identity, and never the ClosureGuard checklist —
// showing it would let responses be written to pass the check rather than to
// resolve the complaint.
const router = Router();

function portalView(c, ledger = []) {
  return {
    id: c._id.toString(),
    caseRef: c.caseRef,
    bureau: c.bureau,
    category: c.category,
    subject: c.subject,
    description: c.description,
    language: c.language,
    status: c.status,
    isOpen: OPEN_STATUSES.includes(c.status),
    createdAt: c.createdAt,
    dueDate: c.dueDate,
    commitments: ledger
      .filter((e) => e.case.toString() === c._id.toString())
      .map((e) => ({ id: e._id.toString(), action: e.action, amount: e.amount, text: e.text, dueDate: e.dueDate, status: e.status })),
    canRespond:
      ['registered', 'under_review', 'awaiting_institution', 'coordination'].includes(c.status) &&
      !c.responses.some((r) => !r.decision?.outcome),
    responses: c.responses.map((r) => ({
      id: r._id.toString(),
      at: r.at,
      source: r.source,
      text: r.text,
      evidence: r.evidence,
      decision: r.decision?.outcome
        ? { outcome: r.decision.outcome, at: r.decision.at, reason: r.decision.outcome === 'request_more' ? r.decision.reason : undefined }
        : null,
    })),
  };
}

async function loadOwnCase(req) {
  const found = await Case.findById(req.params.id);
  if (!found || found.institution.toString() !== req.user.institution?.toString()) {
    throw new HttpError(404, 'Case not found');
  }
  return found;
}

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findById(req.user.institution).lean();
    const cases = await Case.find({ institution: req.user.institution }, { status: 1, dueDate: 1, responses: 1 }).lean();
    res.json({
      institution: { name: institution.name, permanentId: institution.permanentId, city: institution.city, state: institution.state },
      counts: {
        total: cases.length,
        open: cases.filter((c) => OPEN_STATUSES.includes(c.status)).length,
        awaitingYou: cases.filter((c) => c.status === 'awaiting_institution').length,
        overdue: cases.filter((c) => OPEN_STATUSES.includes(c.status) && c.dueDate && c.dueDate < new Date()).length,
      },
    });
  }),
);

router.get(
  '/cases',
  asyncHandler(async (req, res) => {
    const [cases, ledger] = await Promise.all([
      Case.find({ institution: req.user.institution }).sort({ status: 1, createdAt: -1 }),
      LedgerEntry.find({ institution: req.user.institution }, { case: 1, action: 1, amount: 1, text: 1, dueDate: 1, status: 1 }).lean(),
    ]);
    const order = { awaiting_institution: 0, registered: 1, under_review: 1, coordination: 1, resolved_on_promise: 2, resolved: 3, closed: 4 };
    res.json({ cases: cases.map((c) => portalView(c, ledger)).sort((a, b) => order[a.status] - order[b.status]) });
  }),
);

router.get(
  '/cases/:id',
  asyncHandler(async (req, res) => {
    const found = await loadOwnCase(req);
    await audit(req, 'portal.case_view', { entityType: 'case', entityId: found._id, summary: `Institution viewed ${found.caseRef}` });
    const ledger = await LedgerEntry.find({ case: found._id }, { case: 1, action: 1, amount: 1, text: 1, dueDate: 1, status: 1 }).lean();
    res.json({ case: portalView(found, ledger) });
  }),
);

router.post(
  '/cases/:id/responses',
  asyncHandler(async (req, res) => {
    const input = responseInputSchema.parse({ ...req.body, source: 'portal' });
    const found = await loadOwnCase(req);
    const response = await recordResponse(found, input, req.user);

    await audit(req, 'case.response', {
      entityType: 'case',
      entityId: found._id,
      summary: `Institution responded on ${found.caseRef} via portal`,
      meta: { summary: response.review?.summary },
    });
    await notify(
      { roles: ['officer', 'bureau_head'], bureaus: [found.bureau] },
      {
        type: 'response',
        title: `Institution responded: ${found.caseRef}`,
        body: response.review?.summary
          ? `ClosureGuard: ${response.review.summary.addressed}/${response.review.summary.total} concerns addressed. Review and decide.`
          : 'Review the response and decide.',
        link: `/cases/${found._id}`,
      },
    );
    res.status(201).json({ case: portalView(found) });
  }),
);

export default router;
