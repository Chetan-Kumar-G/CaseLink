import mongoose from 'mongoose';

// Append-only, hash-chained audit trail. Each entry stores the hash of the
// previous entry, so any edit or deletion breaks the chain and is detectable
// via GET /api/audit/verify.
const auditSchema = new mongoose.Schema(
  {
    seq: { type: Number, required: true, unique: true },
    at: { type: Date, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorRole: String,
    actorBureau: String,
    action: { type: String, required: true, index: true },
    entityType: String,
    entityId: String,
    summary: String,
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
  },
  { versionKey: false },
);

auditSchema.index({ entityType: 1, entityId: 1 });
auditSchema.index({ actor: 1, at: -1 });

const blockMutation = function blockMutation(next) {
  next(new Error('Audit log is append-only'));
};
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  auditSchema.pre(op, blockMutation);
}
auditSchema.pre('save', function onlyInsert(next) {
  if (!this.isNew) return next(new Error('Audit log is append-only'));
  next();
});

export const AuditLog = mongoose.model('AuditLog', auditSchema);
