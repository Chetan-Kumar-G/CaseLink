import mongoose from 'mongoose';

const institutionSchema = new mongoose.Schema(
  {
    permanentId: { type: String, required: true, unique: true, trim: true, match: /^1-\d{5,12}$/ },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    approvalStatus: { type: String, enum: ['approved', 'under_review', 'withdrawn'], default: 'approved' },
  },
  { timestamps: true },
);

institutionSchema.index({ name: 1 });

export const Institution = mongoose.model('Institution', institutionSchema);
