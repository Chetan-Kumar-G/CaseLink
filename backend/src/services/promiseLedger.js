import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Case } from '../models/Case.js';
import { LedgerEntry, PROMISE_OPEN } from '../models/LedgerEntry.js';
import { PRIORITIES, PROMISES } from '../config/domain.js';
import { env } from '../config/env.js';
import { auditSystem } from './audit.js';
import { notify } from './notify.js';

const DAY = 86_400_000;
const SCORE = { kept: 1, partly_kept: 0.5, broken: 0 };

/** Creates ledger entries for the promises an officer confirmed when resolving a case on promise. */
export async function createEntries(caseDoc, response, confirmed, actor) {
  const byId = new Map((response.review?.promises || []).map((p) => [p.id, p]));
  const docs = confirmed.map((c) => {
    const p = byId.get(c.id);
    return {
      case: caseDoc._id,
      caseRef: caseDoc.caseRef,
      institution: caseDoc.institution?._id || caseDoc.institution,
      bureau: caseDoc.bureau,
      responseId: response._id,
      kind: p.kind,
      action: p.action,
      amount: p.amount,
      text: p.text,
      condition: p.condition,
      deadlineText: p.deadlineText,
      vague: !p.deadline,
      dueDate: new Date(c.dueDate),
      complainantHash: caseDoc.complainant?.idHash,
      createdBy: actor._id,
      createdByName: actor.name,
    };
  });
  return LedgerEntry.insertMany(docs);
}

const checkInLink = (token) => `/check/${token}`;

async function sendCheckIn(entry, now) {
  entry.status = 'awaiting_confirmation';
  entry.checkIn = {
    token: crypto.randomBytes(24).toString('base64url'),
    sentAt: now,
    expiresAt: new Date(now.getTime() + PROMISES.confirmWindowDays * DAY),
  };
  await entry.save();
  const caseDoc = await Case.findById(entry.case, { complainant: 1, caseRef: 1 }).lean();
  // The complainant would receive this by SMS/email; the prototype logs the link.
  if (!env.isProd && !env.isTest) console.log(`[ledger] check-in for ${entry.caseRef} (${caseDoc?.complainant?.email || 'no email'}): ${env.appUrl}${checkInLink(entry.checkIn.token)}`);
  await notify(
    { roles: ['officer'], bureaus: [entry.bureau] },
    {
      type: 'reminder',
      title: `Promise due: ${entry.caseRef}`,
      body: `The institution's deadline for "${entry.action}" has arrived. The complainant has been asked to confirm.`,
      link: '/promises',
    },
  );
  await auditSystem('promise.check_in_sent', { entityType: 'case', entityId: entry.case, summary: `Check-in sent for promise on ${entry.caseRef}` });
  return entry;
}

/** Scheduler pass: send check-ins for due promises; close unanswered ones as unconfirmed. */
export async function runPromiseChecks(now = new Date()) {
  const due = await LedgerEntry.find({ status: 'pending', dueDate: { $lte: now } });
  for (const e of due) await sendCheckIn(e, now);
  const expired = await LedgerEntry.updateMany(
    { status: 'awaiting_confirmation', 'checkIn.expiresAt': { $lt: now } },
    { status: 'unconfirmed' },
  );
  return { checkInsSent: due.length, unconfirmed: expired.modifiedCount };
}

/** Demo control: move a promise's deadline to now and send its check-in immediately. */
export async function fastForward(id, now = new Date()) {
  const entry = await LedgerEntry.findById(id);
  if (!entry || entry.status !== 'pending') return null;
  entry.dueDate = now;
  return sendCheckIn(entry, now);
}

const ANSWER_STATUS = { yes: 'kept', partly: 'partly_kept', no: 'broken' };

/**
 * The complainant's one-tap answer. "No" and "Partly" reopen the case with the
 * broken promise attached as evidence; "No" also raises priority and alerts
 * the bureau head.
 */
export async function answerCheckIn(token, answer, comment) {
  const entry = await LedgerEntry.findOne({ 'checkIn.token': token });
  if (!entry) return { error: 'not_found' };
  if (entry.status !== 'awaiting_confirmation') return { error: entry.status === 'unconfirmed' ? 'expired' : 'already_answered', entry };

  const now = new Date();
  entry.status = ANSWER_STATUS[answer];
  entry.checkIn.answer = answer;
  entry.checkIn.answeredAt = now;
  if (comment) entry.checkIn.comment = comment;
  await entry.save();

  const caseDoc = await Case.findById(entry.case);
  const promiseText = `“${entry.text}”${entry.amount ? ` (Rs ${entry.amount.toLocaleString('en-IN')})` : ''}`;

  if (answer === 'yes') {
    const stillOpen = await LedgerEntry.countDocuments({ case: entry.case, status: { $in: PROMISE_OPEN } });
    caseDoc.history.push({ at: now, byName: 'Complainant', action: 'promise_kept', note: `Confirmed the institution kept its promise: ${promiseText}` });
    if (!stillOpen && caseDoc.status === 'resolved_on_promise') {
      caseDoc.history.push({ at: now, byName: 'System', action: 'status_changed', note: 'Every promise confirmed as kept', from: 'resolved_on_promise', to: 'resolved' });
      caseDoc.status = 'resolved';
    }
    await caseDoc.save();
    await auditSystem('promise.kept', { entityType: 'case', entityId: caseDoc._id, summary: `Promise kept on ${caseDoc.caseRef}` });
    return { entry };
  }

  const from = caseDoc.status;
  caseDoc.status = 'under_review';
  if (answer === 'no') {
    const i = PRIORITIES.indexOf(caseDoc.priority);
    caseDoc.priority = PRIORITIES[Math.min(PRIORITIES.length - 1, i + 1)];
    caseDoc.escalationLevel = Math.max(caseDoc.escalationLevel || 0, 1);
    caseDoc.escalations.push({ level: 1, at: now, label: 'Escalated to bureau head: promise broken' });
  }
  caseDoc.dueDate = new Date(now.getTime() + 7 * DAY);
  caseDoc.history.push({
    at: now,
    byName: 'Complainant',
    action: 'promise_broken',
    note: `${answer === 'no' ? 'Reported the promise was NOT kept' : 'Reported the promise was only partly kept'}: ${promiseText}, due ${entry.dueDate.toDateString()}.${comment ? ` Complainant: “${comment}”` : ''} Case reopened${answer === 'no' ? ` and priority raised to ${caseDoc.priority}` : ''}.`,
    from,
    to: 'under_review',
  });
  await caseDoc.save();

  await notify(
    { roles: answer === 'no' ? ['officer', 'bureau_head'] : ['officer'], bureaus: [caseDoc.bureau] },
    {
      type: 'escalation',
      title: `Promise ${answer === 'no' ? 'broken' : 'partly kept'}: ${caseDoc.caseRef} reopened`,
      body: `${entry.action} — the complainant says the institution did not deliver.`,
      link: `/cases/${caseDoc._id}`,
    },
  );
  await notify(
    { roles: ['institution'], institution: caseDoc.institution },
    { type: 'response', title: `Complaint reopened: ${caseDoc.caseRef}`, body: `The complainant reports your commitment was not met: ${promiseText}`, link: `/portal/cases/${caseDoc._id}` },
  );
  await auditSystem(answer === 'no' ? 'promise.broken' : 'promise.partly_kept', {
    entityType: 'case',
    entityId: caseDoc._id,
    summary: `${caseDoc.caseRef} reopened: promise ${answer === 'no' ? 'broken' : 'partly kept'}`,
    meta: { promise: entry._id.toString(), answer },
  });
  return { entry, reopened: true };
}

/**
 * Promise Kept Rate per institution: kept = 1, partly kept = 0.5, broken = 0,
 * over promises whose outcome is known. Unconfirmed and open ones are counted
 * but not scored — the institution is judged only on confirmed outcomes.
 */
export async function promiseRates(institutionIds) {
  const match = institutionIds ? { institution: { $in: institutionIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } : {};
  const rows = await LedgerEntry.aggregate([{ $match: match }, { $group: { _id: { i: '$institution', s: '$status' }, n: { $sum: 1 } } }]);
  const out = new Map();
  for (const r of rows) {
    const key = r._id.i.toString();
    const t = out.get(key) || { kept: 0, partly_kept: 0, broken: 0, pending: 0, awaiting_confirmation: 0, unconfirmed: 0 };
    t[r._id.s] = r.n;
    out.set(key, t);
  }
  for (const [key, t] of out) {
    const decided = t.kept + t.partly_kept + t.broken;
    const score = t.kept * SCORE.kept + t.partly_kept * SCORE.partly_kept;
    out.set(key, {
      ...t,
      open: t.pending + t.awaiting_confirmation,
      decided,
      total: decided + t.pending + t.awaiting_confirmation + t.unconfirmed,
      rate: decided ? Math.round((score / decided) * 100) : null,
    });
  }
  return out;
}

export const publicCheckIn = (entry, institutionName) => ({
  institution: institutionName,
  caseRef: entry.caseRef,
  action: entry.action,
  amount: entry.amount || null,
  promiseText: entry.text,
  dueDate: entry.dueDate,
  status: entry.status,
  answer: entry.checkIn?.answer || null,
  expiresAt: entry.checkIn?.expiresAt || null,
});
