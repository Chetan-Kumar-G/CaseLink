import mongoose from 'mongoose';

// One institution commitment, tracked like a debt until the complainant
// confirms it was kept. Created when an officer resolves a case on promise.
const promiseSchema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    caseRef: { type: String, required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    bureau: { type: String, required: true },
    responseId: mongoose.Schema.Types.ObjectId,
    kind: { type: String, enum: ['commitment', 'stall'], default: 'commitment' },
    action: { type: String, required: true },
    amount: Number,
    text: { type: String, required: true, maxlength: 1000 }, // the institution's own words
    condition: String,
    deadlineText: String,
    vague: { type: Boolean, default: false }, // no deadline given; CaseLink set a default
    dueDate: { type: Date, required: true, index: true },
    complainantHash: String, // keyed hash only — never the identity
    status: {
      type: String,
      enum: ['pending', 'awaiting_confirmation', 'kept', 'partly_kept', 'broken', 'unconfirmed'],
      default: 'pending',
      index: true,
    },
    checkIn: {
      token: { type: String, index: { unique: true, sparse: true } },
      sentAt: Date,
      expiresAt: Date,
      answer: { type: String, enum: ['yes', 'partly', 'no'] },
      answeredAt: Date,
      comment: { type: String, maxlength: 500 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: String,
  },
  { timestamps: true },
);

export const PROMISE_OPEN = ['pending', 'awaiting_confirmation'];

// Named LedgerEntry in code so it never shadows the built-in Promise.
export const LedgerEntry = mongoose.model('LedgerEntry', promiseSchema, 'promises');
