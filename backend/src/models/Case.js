import mongoose from 'mongoose';
import {
  BUREAU_CODES,
  CATEGORY_CODES,
  CHANNEL_CODES,
  OPEN_STATUSES,
  PRIORITIES,
  STATUS_CODES,
} from '../config/domain.js';

const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    action: { type: String, required: true },
    note: { type: String, maxlength: 2000 },
    from: String,
    to: String,
  },
  { _id: false },
);

// ClosureGuard: the institution's response, the automated adequacy review and
// the officer's decision. Reviews are recommendations; only `decision` acts.
const spanSchema = new mongoose.Schema({ text: String, start: Number, end: Number }, { _id: false });

const concernSchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    text: String,
    start: Number,
    end: Number,
    concepts: [String],
    status: { type: String, enum: ['addressed', 'partial', 'not_addressed'] },
    reason: String,
    responseSpan: spanSchema,
    similarity: Number,
    expectedEvidence: String,
    evidenceFound: [String],
    missingEvidence: Boolean,
  },
  { _id: false },
);

const responseSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  source: { type: String, enum: ['institution_letter', 'portal', 'email', 'hearing'], required: true },
  text: { type: String, required: true, maxlength: 8000 },
  evidence: [{ type: { type: String }, reference: String, _id: false }],
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recordedByName: String,
  review: {
    ranAt: Date,
    mode: String,
    model: String,
    concerns: [concernSchema],
    inconsistencies: [{ type: { type: String }, detail: String, _id: false }],
    summary: { total: Number, addressed: Number, partial: Number, notAddressed: Number },
    recommendation: String,
    error: String,
    // Commitments found in the reply (Promise Ledger candidates).
    promises: [
      {
        id: String,
        kind: { type: String, enum: ['commitment', 'stall'] },
        action: String,
        amount: Number,
        deadline: Date,
        deadlineText: String,
        condition: String,
        vague: Boolean,
        text: String,
        start: Number,
        end: Number,
        _id: false,
      },
    ],
  },
  // Near-identical reply text sent to other complainants of the same institution.
  template: {
    others: Number,
    similarity: Number,
    caseRefs: [String],
    bureaus: [String],
  },
  decision: {
    outcome: { type: String, enum: ['accept', 'accept_on_promise', 'request_more'] },
    reason: String,
    openConcerns: Number,
    overrides: [{ concernId: String, status: String, _id: false }],
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    at: Date,
  },
});

const caseSchema = new mongoose.Schema(
  {
    caseRef: { type: String, required: true, unique: true },
    bureau: { type: String, enum: BUREAU_CODES, required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    permanentId: { type: String, required: true },
    channel: { type: String, enum: CHANNEL_CODES, required: true },
    category: { type: String, enum: CATEGORY_CODES, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    language: { type: String, enum: ['en', 'hi', 'mixed', 'unknown'], default: 'en' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: STATUS_CODES, default: 'registered' },
    complainant: {
      name: { type: String, trim: true, maxlength: 120 },
      email: { type: String, trim: true, lowercase: true, maxlength: 200 },
      phone: { type: String, trim: true, maxlength: 20 },
      idHash: { type: String, index: true },
    },
    relatedRefs: [{ type: String, uppercase: true, trim: true }],
    externalRef: { type: String, trim: true, index: { sparse: true } },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedToName: String,
    dueDate: Date,
    closedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: [historySchema],
    responses: [responseSchema],
    escalationLevel: { type: Number, default: 0 },
    reminderSentAt: Date,
    escalations: [{ level: Number, at: Date, label: String, _id: false }],
  },
  { timestamps: true },
);

caseSchema.index({ institution: 1, createdAt: -1 });
caseSchema.index({ bureau: 1, status: 1 });
caseSchema.index({ dueDate: 1 });

caseSchema.virtual('isOpen').get(function isOpen() {
  return OPEN_STATUSES.includes(this.status);
});

caseSchema.virtual('isOverdue').get(function isOverdue() {
  return OPEN_STATUSES.includes(this.status) && this.dueDate && this.dueDate < new Date();
});

caseSchema.set('toObject', { virtuals: true });
caseSchema.set('toJSON', { virtuals: true });

export const Case = mongoose.model('Case', caseSchema);
