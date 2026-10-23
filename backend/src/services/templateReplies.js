import { Case } from '../models/Case.js';
import { PROMISES } from '../config/domain.js';

// Copy-paste detection: an institution sending (almost) the same reply text to
// many complainants is stalling, not resolving. Measured as word 3-gram
// Jaccard overlap after normalising numbers, dates and case references, so
// "Rs 40,000 by 30 Nov" and "Rs 25,000 by 2 Dec" still count as the same text.
// Deliberately literal (not semantic): two genuine refunds described in
// different words are not a template.

function shingles(text) {
  const words = text
    .toLowerCase()
    .replace(/(?:pgrc|rb|ab)\/\d{4}\/\d+/g, ' ref ')
    .replace(/\d[\d,./-]*/g, ' # ')
    .replace(/[^\p{L}#\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 2 < words.length; i += 1) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  if (!set.size && words.length) set.add(words.join(' '));
  return set;
}

export function similarity(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/** Returns the template flag for a reply, or undefined when it looks original. */
export async function detectTemplate(caseDoc, text) {
  const others = await Case.find(
    { institution: caseDoc.institution?._id || caseDoc.institution, _id: { $ne: caseDoc._id }, 'responses.0': { $exists: true } },
    { caseRef: 1, bureau: 1, 'complainant.idHash': 1, 'responses.text': 1 },
  ).lean();

  const matches = [];
  for (const o of others) {
    // Same complainant filing twice is a duplicate case, not a template.
    if (o.complainant?.idHash && o.complainant.idHash === caseDoc.complainant?.idHash) continue;
    const best = Math.max(...o.responses.map((r) => similarity(text, r.text)));
    if (best >= PROMISES.templateSimilarity) matches.push({ caseRef: o.caseRef, bureau: o.bureau, score: best });
  }
  if (matches.length < PROMISES.templateMinOthers) return undefined;
  return {
    others: matches.length,
    similarity: Number(Math.min(...matches.map((m) => m.score)).toFixed(2)),
    caseRefs: matches.map((m) => m.caseRef).sort(),
    bureaus: [...new Set(matches.map((m) => m.bureau))].sort(),
  };
}
