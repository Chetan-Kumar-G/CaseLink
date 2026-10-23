import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { Institution } from '../models/Institution.js';
import { answerCheckIn, publicCheckIn } from '../services/promiseLedger.js';
import { HttpError, asyncHandler } from '../utils/http.js';

// Public complainant check-in, reached from the link in their SMS/email.
// No account: the unguessable single-use token is the credential. It reveals
// only the institution, the promised action and its date — no personal data.
const router = Router();

router.use(
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests, please try again later' } }),
);

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

async function load(token) {
  if (!TOKEN.test(token)) throw new HttpError(404, 'This link is not valid');
  const entry = await LedgerEntry.findOne({ 'checkIn.token': token });
  if (!entry) throw new HttpError(404, 'This link is not valid');
  const inst = await Institution.findById(entry.institution, { name: 1 }).lean();
  return { entry, institutionName: inst?.name };
}

router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { entry, institutionName } = await load(req.params.token);
    res.json(publicCheckIn(entry, institutionName));
  }),
);

const answerSchema = z.object({
  answer: z.enum(['yes', 'partly', 'no']),
  comment: z.string().trim().max(500).optional(),
});

router.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const { answer, comment } = answerSchema.parse(req.body);
    const { institutionName } = await load(req.params.token);
    const result = await answerCheckIn(req.params.token, answer, comment || undefined);
    if (result.error === 'already_answered') throw new HttpError(409, 'This check-in has already been answered. Thank you.');
    if (result.error === 'expired') throw new HttpError(410, 'This check-in has expired. Please contact the grievance cell if the promise was not kept.');
    res.json({ ...publicCheckIn(result.entry, institutionName), reopened: Boolean(result.reopened) });
  }),
);

export default router;
