import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { BUREAU_CODES, ROLE_CODES } from '../config/domain.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_CODES, required: true },
    bureau: {
      type: String,
      enum: BUREAU_CODES,
      required() {
        return ['officer', 'bureau_head'].includes(this.role);
      },
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required() {
        return this.role === 'institution';
      },
    },
    designation: { type: String, trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.registerFailedLogin = async function registerFailedLogin() {
  this.failedLogins = (this.failedLogins || 0) + 1;
  if (this.failedLogins >= MAX_FAILED) {
    this.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
    this.failedLogins = 0;
  }
  await this.save();
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    bureau: this.bureau || null,
    designation: this.designation || null,
    institution: this.institution ? this.institution.toString() : null,
    lastLoginAt: this.lastLoginAt || null,
  };
};

export const User = mongoose.model('User', userSchema);
