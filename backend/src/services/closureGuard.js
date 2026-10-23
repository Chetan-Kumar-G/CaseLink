import { closureCheck } from './aiClient.js';

// Maps the AI service's snake_case result onto the Case.responses[].review shape.
export async function reviewResponse(caseDoc, response) {
  const result = await closureCheck({
    // The subject is a summary of the description, so only the description is checked.
    complaint: caseDoc.description,
    response: response.text,
    evidence: (response.evidence || []).map((e) => ({ type: e.type, reference: e.reference || '' })),
    receivedOn: new Date(response.at || Date.now()).toISOString().slice(0, 10),
  });
  if (!result) {
    return { ranAt: new Date(), error: 'ClosureGuard was unavailable (AI service offline). Re-run the review, or decide manually with a full reason.' };
  }
  return {
    ranAt: new Date(),
    mode: result.mode,
    model: result.model,
    concerns: result.concerns.map((c) => ({
      id: c.id,
      label: c.label,
      text: c.text,
      start: c.start,
      end: c.end,
      concepts: c.concepts,
      status: c.status,
      reason: c.reason,
      responseSpan: c.response_span || undefined,
      similarity: c.similarity ?? undefined,
      expectedEvidence: c.expected_evidence || undefined,
      evidenceFound: c.evidence_found || [],
      missingEvidence: Boolean(c.missing_evidence),
    })),
    inconsistencies: result.inconsistencies,
    summary: {
      total: result.summary.total,
      addressed: result.summary.addressed,
      partial: result.summary.partial,
      notAddressed: result.summary.not_addressed,
    },
    recommendation: result.recommendation,
    promises: (result.promises || []).map((p) => ({
      id: p.id,
      kind: p.kind,
      action: p.action,
      amount: p.amount ?? undefined,
      deadline: p.deadline ? new Date(`${p.deadline}T23:59:59`) : undefined,
      deadlineText: p.deadline_text || undefined,
      condition: p.condition || undefined,
      vague: Boolean(p.vague),
      text: p.text,
      start: p.start,
      end: p.end,
    })),
  };
}
