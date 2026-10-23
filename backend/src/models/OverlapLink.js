import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    layers: [{ type: String, enum: ['exact', 'rule', 'semantic'] }],
    matchedFields: [{ field: String, label: String, value: String, _id: false }],
    sharedTerms: [String],
    similarity: Number,
    semanticMode: String,
    daysApart: Number,
    explanation: String,
  },
  { _id: false },
);

const overlapSchema = new mongoose.Schema(
  {
    pairKey: { type: String, required: true, unique: true },
    caseA: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    caseB: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    bureaus: [String],
    crossBureau: { type: Boolean, default: false },
    kind: { type: String, enum: ['duplicate', 'related'], required: true },
    score: { type: Number, min: 0, max: 1 },
    evidence: evidenceSchema,
    status: {
      type: String,
      enum: ['pending', 'linked', 'dismissed', 'coordination_requested'],
      default: 'pending',
    },
    decision: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      byName: String,
      byBureau: String,
      at: Date,
      reason: { type: String, maxlength: 1000 },
    },
  },
  { timestamps: true },
);

overlapSchema.index({ status: 1, crossBureau: 1 });
overlapSchema.index({ institution: 1 });
overlapSchema.index({ caseA: 1 });
overlapSchema.index({ caseB: 1 });

export const pairKeyFor = (a, b) => [a.toString(), b.toString()].sort().join(':');

export const OverlapLink = mongoose.model('OverlapLink', overlapSchema);
