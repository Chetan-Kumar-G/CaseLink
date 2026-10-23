import { Case } from '../models/Case.js';
import { OverlapLink, pairKeyFor } from '../models/OverlapLink.js';
import { OVERLAP, categoryLabel } from '../config/domain.js';
import { semanticSimilarity } from './aiClient.js';
import { auditSystem } from './audit.js';
import { notify } from './notify.js';

const DAY = 86_400_000;
const caseText = (c) => `${c.subject}. ${c.description}`;
const LAYER_ORDER = ['exact', 'rule', 'semantic'];

function exactEvidence(a, b) {
  const fields = [];
  const refsA = new Set(a.relatedRefs || []);
  const refsB = new Set(b.relatedRefs || []);
  if (refsA.has(b.caseRef) || refsB.has(a.caseRef)) {
    const quoted = refsA.has(b.caseRef) ? b.caseRef : a.caseRef;
    fields.push({ field: 'caseRef', label: 'Case reference quoted', value: quoted });
  }
  if (a.complainant?.idHash && a.complainant.idHash === b.complainant?.idHash) {
    fields.push({ field: 'complainant', label: 'Same complainant', value: 'Matched on hashed email / phone' });
  }
  return fields;
}

function ruleEvidence(a, b) {
  if (a.category !== b.category) return null;
  const daysApart = Math.round(Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) / DAY);
  if (daysApart > OVERLAP.ruleWindowDays) return null;
  return {
    daysApart,
    field: { field: 'category', label: 'Same issue category', value: categoryLabel(a.category) },
  };
}

function explain({ layers, matchedFields, similarity, sharedTerms, daysApart, crossBureau, semanticMode }) {
  const parts = [];
  if (layers.includes('exact')) {
    parts.push(matchedFields.filter((f) => ['caseRef', 'complainant'].includes(f.field)).map((f) => f.label).join(' and '));
  }
  if (layers.includes('rule')) parts.push(`same category, filed ${daysApart} day${daysApart === 1 ? '' : 's'} apart`);
  if (layers.includes('semantic')) {
    const terms = sharedTerms?.length ? ` (shared concepts: ${sharedTerms.slice(0, 5).join(', ')})` : '';
    parts.push(`complaint text ${Math.round(similarity * 100)}% similar via ${semanticMode} matching${terms}`);
  }
  const lead = crossBureau ? 'Cross-bureau overlap at the same institution: ' : 'Same institution: ';
  return lead + parts.filter(Boolean).join('; ') + '.';
}

/**
 * Compares a case against other cases of the same institution through three
 * layers — exact identifiers, configurable rules and multilingual semantic
 * similarity — and records each potential overlap for human review.
 * Nothing is merged; decided overlaps are never reopened.
 */
export async function detectOverlaps(caseId, { notify: shouldNotify = true } = {}) {
  const target = await Case.findById(caseId).lean();
  if (!target) return { overlaps: [], semantic: { ran: false } };

  const candidates = await Case.find({ institution: target.institution, _id: { $ne: target._id } })
    .sort({ createdAt: -1 })
    .limit(OVERLAP.candidateLimit)
    .lean();
  if (!candidates.length) return { overlaps: [], semantic: { ran: true, mode: 'none' } };

  const sem = await semanticSimilarity(
    { id: target._id.toString(), text: caseText(target) },
    candidates.map((c) => ({ id: c._id.toString(), text: caseText(c) })),
  );
  const semById = new Map((sem?.results || []).map((r) => [r.id, r]));

  const found = [];
  for (const other of candidates) {
    const layers = [];
    const matchedFields = [{ field: 'permanentId', label: 'Same institution', value: target.permanentId }];

    const exact = exactEvidence(target, other);
    if (exact.length) {
      layers.push('exact');
      matchedFields.push(...exact);
    }

    const rule = ruleEvidence(target, other);
    if (rule) {
      layers.push('rule');
      matchedFields.push(rule.field);
    }

    const s = semById.get(other._id.toString());
    const semanticHit = s && s.score >= sem.threshold;
    if (semanticHit) layers.push('semantic');

    if (!layers.length) continue;

    const crossBureau = target.bureau !== other.bureau;
    const evidence = {
      layers: LAYER_ORDER.filter((l) => layers.includes(l)),
      matchedFields,
      sharedTerms: s?.shared_terms || [],
      similarity: s ? Number(s.score.toFixed(3)) : undefined,
      semanticMode: sem?.mode,
      daysApart: rule?.daysApart ?? Math.round(Math.abs(new Date(target.createdAt) - new Date(other.createdAt)) / DAY),
    };
    evidence.explanation = explain({ ...evidence, crossBureau });

    const score = layers.includes('exact')
      ? 1
      : Math.max(rule ? OVERLAP.ruleScore : 0, semanticHit ? s.score : 0);

    const [first, second] = [target, other].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
    const pairKey = pairKeyFor(target._id, other._id);
    const existing = await OverlapLink.findOne({ pairKey });

    if (existing && existing.status !== 'pending') {
      found.push(existing);
      continue;
    }

    const doc = await OverlapLink.findOneAndUpdate(
      { pairKey },
      {
        $set: {
          caseA: first._id,
          caseB: second._id,
          institution: target.institution,
          bureaus: [...new Set([first.bureau, second.bureau])],
          crossBureau,
          kind: layers.includes('exact') ? 'duplicate' : 'related',
          score: Number(score.toFixed(3)),
          evidence,
        },
        $setOnInsert: { status: 'pending' },
      },
      { upsert: true, new: true },
    );

    if (!existing) {
      await auditSystem('overlap.detected', {
        entityType: 'overlap',
        entityId: doc._id,
        summary: `${doc.kind === 'duplicate' ? 'Probable duplicate' : 'Related case'}: ${first.caseRef} ↔ ${second.caseRef}`,
        meta: { layers: evidence.layers, score: doc.score, crossBureau },
      });
      if (shouldNotify && crossBureau) {
        await notify(
          { roles: ['officer', 'bureau_head'], bureaus: doc.bureaus },
          {
            type: 'overlap',
            title: `Cross-bureau overlap: ${first.caseRef} ↔ ${second.caseRef}`,
            body: `${doc.kind === 'duplicate' ? 'Probable duplicate' : 'Related case'} at ${target.permanentId}. Review and decide on the overlap.`,
            link: '/overlaps',
          },
        );
      }
    }
    found.push(doc);
  }

  return {
    overlaps: found,
    semantic: sem ? { ran: true, mode: sem.mode, model: sem.model, threshold: sem.threshold } : { ran: false },
  };
}
