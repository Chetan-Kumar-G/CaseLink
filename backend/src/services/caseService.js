import { z } from 'zod';
import { Case } from '../models/Case.js';
import { Institution } from '../models/Institution.js';
import { nextSequence } from '../models/Counter.js';
import { BUREAU_CODES, CATEGORY_CODES, CHANNEL_CODES, PRIORITIES, slaDaysFor } from '../config/domain.js';
import { detectLanguage, extractCaseRefs, identityHash } from '../utils/text.js';
import { HttpError } from '../utils/http.js';
import { reviewResponse } from './closureGuard.js';
import { notify } from './notify.js';
import { detectTemplate } from './templateReplies.js';

const DAY = 86_400_000;
const optionalText = (schema) => schema.optional().or(z.literal('').transform(() => undefined));

export const caseInputSchema = z.object({
  permanentId: z.string().trim().regex(/^1-\d{5,12}$/, 'Enter a valid AICTE Permanent ID, e.g. 1-2468013579'),
  bureau: z.enum(BUREAU_CODES).optional(),
  channel: z.enum(CHANNEL_CODES),
  category: z.enum(CATEGORY_CODES),
  priority: z.enum(PRIORITIES).default('medium'),
  subject: z.string().trim().min(5, 'Subject is too short').max(200),
  description: z.string().trim().min(20, 'Please describe the complaint in at least 20 characters').max(5000),
  complainant: z.object({
    name: z.string().trim().min(2, 'Enter the complainant name').max(120),
    email: optionalText(z.string().trim().email('Enter a valid email').max(200)),
    phone: optionalText(z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid phone number')),
  }),
  relatedRefs: z.array(z.string().trim().toUpperCase().max(40)).max(10).optional(),
});

/**
 * Creates a case for an institution. `receivedAt` backdates imported cases so
 * deadlines and overlap windows reflect when the complaint actually arrived.
 */
export async function createCase(input, { bureau, actor, receivedAt, note }) {
  const institution = await Institution.findOne({ permanentId: input.permanentId });
  if (!institution) throw new HttpError(404, 'No institution found with this AICTE Permanent ID');

  const at = receivedAt || new Date();
  const year = at.getFullYear();
  const seq = await nextSequence(`case:${bureau}:${year}`);
  const caseRef = `${bureau}/${year}/${String(seq).padStart(4, '0')}`;
  const relatedRefs = [...new Set([...(input.relatedRefs || []), ...extractCaseRefs(input.description)])].filter((r) => r !== caseRef);

  const doc = new Case({
    caseRef,
    bureau,
    institution: institution._id,
    permanentId: institution.permanentId,
    channel: input.channel,
    category: input.category,
    priority: input.priority,
    subject: input.subject,
    description: input.description,
    language: detectLanguage(`${input.subject} ${input.description}`),
    complainant: { ...input.complainant, idHash: identityHash(input.complainant) },
    relatedRefs,
    externalRef: input.externalRef,
    assignedTo: actor._id,
    assignedToName: actor.name,
    dueDate: new Date(at.getTime() + slaDaysFor(input.category) * DAY),
    createdBy: actor._id,
    history: [{ at, by: actor._id, byName: actor.name, action: 'registered', note: note || `Registered via ${input.channel}`, to: 'registered' }],
    createdAt: at,
    updatedAt: new Date(),
  });
  await doc.save({ timestamps: false });
  return { created: doc, institution };
}

export const EVIDENCE_TYPES = ['payment_proof', 'acknowledgement', 'committee_report', 'inspection_report', 'official_letter', 'photographs', 'other'];

export const responseInputSchema = z.object({
  source: z.enum(['institution_letter', 'portal', 'email', 'hearing']),
  text: z.string().trim().min(20, 'Write the response in at least 20 characters').max(8000),
  evidence: z
    .array(z.object({ type: z.enum(EVIDENCE_TYPES), reference: z.string().trim().max(300).default('') }))
    .max(20)
    .default([]),
});

/** Adds a response, runs ClosureGuard and moves the case under review. */
export async function recordResponse(found, input, actor) {
  if (!['registered', 'under_review', 'awaiting_institution', 'coordination'].includes(found.status)) {
    throw new HttpError(409, 'Responses can only be recorded on open cases');
  }
  if (found.responses.some((r) => !r.decision?.outcome)) {
    throw new HttpError(409, 'A previous response is still awaiting a decision');
  }
  const response = { ...input, at: new Date(), recordedBy: actor._id, recordedByName: actor.name };
  response.review = await reviewResponse(found, response);
  response.template = await detectTemplate(found, response.text);
  found.responses.push(response);
  const from = found.status;
  if (from !== 'under_review') found.status = 'under_review';
  found.history.push({
    by: actor._id,
    byName: actor.name,
    action: 'response_recorded',
    note: response.review.summary
      ? `Institution response recorded${input.source === 'portal' ? ' via portal' : ''}. ClosureGuard: ${response.review.summary.addressed}/${response.review.summary.total} concerns addressed`
      : 'Institution response recorded. ClosureGuard review pending',
    ...(from !== found.status ? { from, to: found.status } : {}),
  });
  await found.save();
  return response;
}

/** Tells the institution's portal users that AICTE needs action from them. */
export function notifyInstitution(found, { title, body }) {
  return notify(
    { roles: ['institution'], institution: found.institution?._id || found.institution },
    { type: 'response', title, body, link: `/portal/cases/${found._id}` },
  );
}
