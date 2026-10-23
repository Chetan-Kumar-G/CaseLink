import { maskName } from '../utils/text.js';

export const isGlobalRole = (user) => ['admin', 'senior_reviewer'].includes(user.role);

// Full access to a case's personal data only within the user's own bureau.
export const hasBureauAccess = (user, bureau) => isGlobalRole(user) || user.bureau === bureau;

export const canEditCase = (user, caseDoc) =>
  user.role === 'admin' ||
  (['officer', 'bureau_head'].includes(user.role) && user.bureau === caseDoc.bureau);

export const canDecideOverlap = (user, overlap) =>
  isGlobalRole(user) ||
  (['officer', 'bureau_head'].includes(user.role) && overlap.bureaus.includes(user.bureau));

// Cross-bureau views keep the complaint text (needed for coordination) but
// mask the complainant's identity and contact details.
export function serializeCase(doc, user) {
  if (!doc) return doc;
  const c = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  const full = hasBureauAccess(user, c.bureau);
  const complainant = c.complainant || {};
  c.complainant = full
    ? { name: complainant.name, email: complainant.email, phone: complainant.phone, masked: false }
    : { name: complainant.name ? maskName(complainant.name) : undefined, masked: true };
  c.access = full ? 'full' : 'masked';
  c.id = c._id?.toString();
  delete c.__v;
  return c;
}
