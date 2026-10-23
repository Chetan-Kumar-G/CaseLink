// Promise Ledger demo history (synthetic). Seeded after overlap detection so
// these past cases do not clutter the overlap queue.
//
// Sunrise Institute: 5 past promises — 4 kept, 1 broken — so its Promise Kept
// Rate starts at 80%. Two of its past replies, to different complainants in
// PGRC and RB, reuse the same "within 30 days after approval of the
// management" wording, so a third such reply is flagged as a template.
import crypto from 'node:crypto';
import { Case } from '../models/Case.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { nextSequence } from '../models/Counter.js';
import { detectLanguage, identityHash } from '../utils/text.js';

const DAY = 86_400_000;
const TEMPLATE = (amount) => `The refund of Rs ${amount} will be processed within 30 days after approval of the management.`;

const HISTORY = [
  // Sunrise Institute of Technology
  { inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 300, category: 'fee_refund', subject: 'Hostel fee refund after vacating', description: 'I vacated the hostel in the first month but the institute has not refunded the hostel fee of Rs 12,000.', who: ['Neha Patil', 'neha.p@example.com'], reply: TEMPLATE('12,000'), action: 'Refund of fees', amount: 12000, after: 30, outcome: 'yes' },
  { inst: '1-2468013579', bureau: 'AB', owner: 'ab', daysAgo: 270, category: 'certificates', subject: 'Original certificates not returned', description: 'The college has not returned my original Class 12 certificate after admission verification.', who: ['Rohan Deshmukh', 'rohan.d@example.com'], reply: 'The original certificate will be returned to the student within 15 days.', action: 'Return of original documents', after: 15, outcome: 'yes' },
  { inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 240, category: 'scholarship', subject: 'Scholarship not credited', description: 'My merit scholarship for the second semester has not been credited to my account.', who: ['Asif Khan', 'asif.k@example.com'], reply: 'The scholarship amount will be credited by next month.', action: 'Scholarship disbursal', after: 30, outcome: 'yes' },
  { inst: '1-2468013579', bureau: 'RB', owner: 'rb', daysAgo: 205, category: 'fee_refund', subject: 'Withdrawal refund pending for months', description: 'I withdrew from the MBA programme but the institute is still holding my fee of Rs 60,000 and does not reply.', who: ['Divya Menon', 'divya.m@example.com'], reply: TEMPLATE('60,000'), action: 'Refund of fees', amount: 60000, after: 30, outcome: 'no' },
  { inst: '1-2468013579', bureau: 'PGRC', owner: 'pgrc', daysAgo: 170, category: 'hostel', subject: 'Broken water purifiers in hostel', description: 'All water purifiers in the girls hostel are broken and students are not getting clean drinking water.', who: ['Sana Qureshi', 'sana.q@example.com'], reply: 'New water purifiers will be installed within 3 weeks.', action: 'Water supply', after: 21, outcome: 'yes' },
  // Other institutions — a mix of kept, broken and still-open promises.
  { inst: '1-1357924680', bureau: 'PGRC', owner: 'pgrc', daysAgo: 150, category: 'fee_refund', subject: 'Caution deposit not refunded', description: 'I graduated in May but the caution deposit of Rs 10,000 has not been refunded.', who: ['Manish Tiwari', 'manish.t@example.com'], reply: 'The caution deposit will be refunded within 30 days.', action: 'Refund of caution deposit', amount: 10000, after: 30, outcome: 'yes' },
  { inst: '1-1357924680', bureau: 'AB', owner: 'ab', daysAgo: 25, category: 'infrastructure', subject: 'Computer lab systems not working', description: 'Half the systems in the computer lab are not working for two months.', who: ['Lab Students Group', 'lab.vce@example.com'], reply: 'The non-working systems will be replaced within 30 days.', action: 'Laboratory facilities', after: 30, outcome: null },
  { inst: '1-9876543210', bureau: 'PGRC', owner: 'pgrc', daysAgo: 20, category: 'excess_fee', subject: 'Library fee charged twice', description: 'The institute charged the library fee of Rs 2,500 twice this semester and has not returned the extra amount.', who: ['Kavya Shetty', 'kavya.s@example.com'], reply: 'The extra library fee of Rs 2,500 will be adjusted within 15 days.', action: 'Excess / unapproved fee collected', amount: 2500, after: 15, outcome: null },
  { inst: '1-7788990011', bureau: 'RB', owner: 'rb', daysAgo: 110, category: 'faculty', subject: 'Salary arrears not paid', description: 'Faculty have not been paid arrears for three months despite repeated requests.', who: ['Faculty Forum EHIT', 'forum.ehit@example.com'], reply: 'All salary arrears will be paid within 45 days.', action: 'Payment of salaries', after: 45, outcome: 'no' },
];

const STATUS_FOR = { yes: 'kept', partly: 'partly_kept', no: 'broken' };

export async function seedPromiseHistory(insts, users) {
  for (const h of HISTORY) {
    const inst = insts.get(h.inst);
    const owner = users[h.owner];
    const createdAt = new Date(Date.now() - h.daysAgo * DAY);
    const repliedAt = new Date(createdAt.getTime() + 6 * DAY);
    const decidedAt = new Date(repliedAt.getTime() + 2 * DAY);
    const dueDate = new Date(repliedAt.getTime() + h.after * DAY);
    const answeredAt = new Date(dueDate.getTime() + 2 * DAY);
    const open = h.outcome === null;

    const seq = await nextSequence(`case:${h.bureau}:${createdAt.getFullYear()}`);
    const caseRef = `${h.bureau}/${createdAt.getFullYear()}/${String(seq).padStart(4, '0')}`;
    const complainant = { name: h.who[0], email: h.who[1] };
    const history = [
      { at: createdAt, by: owner._id, byName: owner.name, action: 'registered', note: 'Registered via portal', to: 'registered' },
      { at: repliedAt, by: owner._id, byName: owner.name, action: 'response_recorded', note: 'Institution response recorded.', from: 'registered', to: 'under_review' },
      { at: decidedAt, by: owner._id, byName: owner.name, action: 'resolved_on_promise', note: 'Resolved on the institution’s written promise; added to the Promise Ledger.', from: 'under_review', to: 'resolved_on_promise' },
    ];
    if (!open) {
      history.push(
        h.outcome === 'yes'
          ? { at: answeredAt, byName: 'Complainant', action: 'promise_kept', note: `Confirmed the institution kept its promise: “${h.reply}”` }
          : { at: answeredAt, byName: 'Complainant', action: 'promise_broken', note: `Reported the promise was NOT kept: “${h.reply}”. Case reopened.`, from: 'resolved_on_promise', to: 'under_review' },
        { at: new Date(answeredAt.getTime() + 10 * DAY), by: owner._id, byName: owner.name, action: 'status_changed', note: h.outcome === 'yes' ? 'Closed after confirmation' : 'Closed after the institution finally paid', from: h.outcome === 'yes' ? 'resolved' : 'under_review', to: 'closed' },
      );
    }

    const responseId = new Case.base.Types.ObjectId();
    const doc = new Case({
      caseRef,
      bureau: h.bureau,
      institution: inst._id,
      permanentId: inst.permanentId,
      channel: 'portal',
      category: h.category,
      priority: 'medium',
      status: open ? 'resolved_on_promise' : 'closed',
      subject: h.subject,
      description: h.description,
      language: detectLanguage(h.description),
      complainant: { ...complainant, idHash: identityHash(complainant) },
      assignedTo: owner._id,
      assignedToName: owner.name,
      dueDate: new Date(createdAt.getTime() + 30 * DAY),
      closedAt: open ? undefined : history.at(-1).at,
      createdBy: owner._id,
      history,
      responses: [
        {
          _id: responseId,
          at: repliedAt,
          source: 'institution_letter',
          text: h.reply,
          recordedBy: owner._id,
          recordedByName: owner.name,
          review: { ranAt: repliedAt, promises: [{ id: 'p1', kind: 'commitment', action: h.action, amount: h.amount, deadline: dueDate, text: h.reply, start: 0, end: h.reply.length }] },
          decision: { outcome: 'accept_on_promise', reason: 'Institution has committed in writing; tracking the promise.', openConcerns: 1, by: owner._id, byName: owner.name, at: decidedAt },
        },
      ],
      createdAt,
      updatedAt: history.at(-1).at,
    });
    await doc.save({ timestamps: false });

    await LedgerEntry.create({
      case: doc._id,
      caseRef,
      institution: inst._id,
      bureau: h.bureau,
      responseId,
      kind: 'commitment',
      action: h.action,
      amount: h.amount,
      text: h.reply,
      dueDate,
      complainantHash: doc.complainant.idHash,
      status: open ? 'pending' : STATUS_FOR[h.outcome],
      checkIn: open ? undefined : { token: crypto.randomBytes(24).toString('base64url'), sentAt: dueDate, expiresAt: new Date(dueDate.getTime() + 7 * DAY), answer: h.outcome, answeredAt },
      createdBy: owner._id,
      createdByName: owner.name,
      createdAt: decidedAt,
    });
  }
  return HISTORY.length;
}

// Ready-to-use demo reply: a "refund in 30 days" promise that reuses the template wording.
export const DEMO_PROMISE_REPLY = TEMPLATE('85,000');
