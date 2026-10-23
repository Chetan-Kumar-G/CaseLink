import crypto from 'node:crypto';
import { env } from '../config/env.js';

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN = /[A-Za-z]/g;

export function detectLanguage(text = '') {
  const hi = (text.match(DEVANAGARI) || []).length;
  const en = (text.match(LATIN) || []).length;
  if (!hi && !en) return 'unknown';
  const ratio = hi / (hi + en);
  if (ratio > 0.8) return 'hi';
  if (ratio > 0.15) return 'mixed';
  return 'en';
}

// Case references look like PGRC/2026/0004 — complainants often quote earlier ones.
const CASE_REF = /\b(?:PGRC|RB|AB)\/\d{4}\/\d{4,6}\b/gi;
export const extractCaseRefs = (text = '') => [...new Set((text.match(CASE_REF) || []).map((r) => r.toUpperCase()))];

// One-way hash so duplicate complainants can be matched without exposing identity.
export function identityHash({ email, phone } = {}) {
  const normEmail = email?.trim().toLowerCase();
  const normPhone = phone?.replace(/\D/g, '').slice(-10);
  const key = normEmail || (normPhone && normPhone.length >= 10 ? normPhone : '');
  if (!key) return undefined;
  return crypto.createHmac('sha256', env.identityPepper).update(key).digest('hex');
}

export function maskName(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] + '•'.repeat(Math.max(2, Math.min(part.length - 1, 6))))
    .join(' ');
}

// Deterministic JSON (sorted keys) used for audit hash chaining.
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
