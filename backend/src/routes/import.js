import { Router } from 'express';
import { z } from 'zod';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { BUREAU_CODES } from '../config/domain.js';
import { authorize } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { caseInputSchema, createCase } from '../services/caseService.js';
import { detectOverlaps } from '../services/overlapEngine.js';
import { HttpError, asyncHandler } from '../utils/http.js';

// File-based import adapter (CSV/JSON rows) for complaints exported from other
// systems, e.g. CPGRAMS or a bureau's spreadsheet. Live API integration needs
// authorised access; this adapter is the integration point until then.
const router = Router();

router.use(authorize('admin', 'bureau_head'));

const rowSchema = z.object({
  externalRef: z.string().trim().max(60).optional().or(z.literal('').transform(() => undefined)),
  receivedAt: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const d = new Date(v);
      if (Number.isNaN(d.getTime()) || d > new Date()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a past date like 2026-09-14' });
        return z.NEVER;
      }
      return d;
    }),
  bureau: z.string().trim().toUpperCase().optional(),
  permanentId: z.string(),
  channel: z.string().trim().toLowerCase().default('cpgrams'),
  category: z.string().trim().toLowerCase(),
  priority: z.string().trim().toLowerCase().optional().or(z.literal('').transform(() => undefined)),
  subject: z.string(),
  description: z.string(),
  complainantName: z.string(),
  complainantEmail: z.string().optional(),
  complainantPhone: z.string().optional(),
});

const bodySchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'No rows to import').max(500, 'Import at most 500 rows at a time'),
  dryRun: z.boolean().default(true),
});

function flattenIssues(err) {
  return Object.fromEntries(err.issues.map((i) => [i.path.join('.').replace(/^complainant\./, 'complainant_'), i.message]));
}

router.post(
  '/cases',
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = bodySchema.parse(req.body);
    const permanentIds = new Set((await Institution.find({}, { permanentId: 1 }).lean()).map((i) => i.permanentId));
    const refs = rows.map((r) => String(r.externalRef || '').trim()).filter(Boolean);
    const existing = new Set((await Case.find({ externalRef: { $in: refs } }, { externalRef: 1 }).lean()).map((c) => c.externalRef));
    const seenInFile = new Set();

    const results = [];
    let imported = 0;
    let overlapCount = 0;

    for (const [index, raw] of rows.entries()) {
      const row = rowSchema.safeParse(raw);
      if (!row.success) {
        results.push({ row: index + 1, ok: false, errors: flattenIssues(row.error) });
        continue;
      }
      const r = row.data;
      const bureau = req.user.role === 'bureau_head' ? req.user.bureau : r.bureau;
      const errors = {};
      if (!BUREAU_CODES.includes(bureau)) errors.bureau = `Use one of ${BUREAU_CODES.join(', ')}`;
      if (req.user.role === 'bureau_head' && r.bureau && r.bureau !== req.user.bureau) errors.bureau = `You can only import ${req.user.bureau} cases`;
      if (r.externalRef && existing.has(r.externalRef)) {
        results.push({ row: index + 1, ok: false, skipped: true, errors: { externalRef: 'Already imported earlier' } });
        continue;
      }
      if (r.externalRef && seenInFile.has(r.externalRef)) {
        results.push({ row: index + 1, ok: false, skipped: true, errors: { externalRef: 'Duplicate of an earlier row in this file' } });
        continue;
      }
      const input = caseInputSchema.safeParse({
        permanentId: r.permanentId,
        channel: r.channel,
        category: r.category,
        priority: r.priority || 'medium',
        subject: r.subject,
        description: r.description,
        complainant: { name: r.complainantName, email: r.complainantEmail || '', phone: r.complainantPhone || '' },
      });
      if (!input.success) Object.assign(errors, flattenIssues(input.error));
      else if (!permanentIds.has(input.data.permanentId)) errors.permanentId = 'Unknown AICTE Permanent ID';
      if (Object.keys(errors).length) {
        results.push({ row: index + 1, ok: false, errors });
        continue;
      }
      if (r.externalRef) seenInFile.add(r.externalRef);

      if (dryRun) {
        results.push({ row: index + 1, ok: true });
        continue;
      }
      const { created } = await createCase(
        { ...input.data, externalRef: r.externalRef },
        { bureau, actor: req.user, receivedAt: r.receivedAt, note: `Imported${r.externalRef ? ` (external ref ${r.externalRef})` : ''}` },
      );
      const { overlaps } = await detectOverlaps(created._id);
      imported += 1;
      overlapCount += overlaps.length;
      results.push({ row: index + 1, ok: true, caseRef: created.caseRef, id: created._id.toString(), overlaps: overlaps.length });
    }

    if (!dryRun && imported) {
      await audit(req, 'case.import', { summary: `Imported ${imported} case${imported === 1 ? '' : 's'}`, meta: { imported, rows: rows.length, overlaps: overlapCount } });
    }
    if (!dryRun && !imported && results.every((x) => !x.ok)) {
      throw new HttpError(400, 'No valid rows to import', { results });
    }
    res.json({
      dryRun,
      total: rows.length,
      valid: results.filter((x) => x.ok).length,
      imported,
      overlaps: overlapCount,
      results,
    });
  }),
);

export default router;
