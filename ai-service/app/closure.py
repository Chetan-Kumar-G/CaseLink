"""ClosureGuard — resolution adequacy check.

Compares a complaint with an institution's response and produces an
evidence-linked checklist:

1. Split the complaint into concerns: sentences / clauses that carry a
   grievance cue (negation, delay, refusal, demand…) and a known concept.
2. For each concern, find the response sentence that best answers it
   (semantic engine score + shared concepts).
3. Classify: addressed (completed action), partial (promise, dispute, vague
   mention, or action claimed without the evidence it needs), not addressed.
4. Flag inconsistencies such as a refunded amount that differs from the
   amount in the complaint.

Every finding carries character offsets into the original texts so the UI can
highlight exactly what was matched. This is decision support only: it never
accepts or rejects a resolution.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from . import lexicon

# ---- cues -------------------------------------------------------------------

GRIEVANCE_CUES = [
    "not", "no", "never", "without", "refus", "denied", "deny", "withheld", "withhold", "retain",
    "pending", "delay", "still", "yet", "demand", "keeps asking", "come back later", "ignored",
    "harass", "ragg", "irregular", "lack", "shortage", "beyond", "extra", "cancelled", "ill",
    "nahi", "nahin", "nai", "abhi tak", "maang",
    "नहीं", "न ", "बिना", "देरी", "मांग", "रोक", "परेशान", "रैगिंग", "कोई जवाब", "लंबित",
]
COMPLETED_CUES = [
    "refunded", "has been refunded", "returned", "released", "credited", "paid", "processed",
    "issued", "completed", "handed over", "resolved", "rectified", "repaired", "fixed",
    "suspended", "expelled", "action taken", "transferred", "disbursed", "deposited", "restored",
    "वापस कर दी", "वापस कर दिया", "जारी कर", "भुगतान कर", "जमा कर दिया",
]
PROMISE_CUES = [
    "will ", "shall ", "would ", "is being", "are being", "under process", "in process", "in progress",
    "soon", "shortly", "next week", "next month", "after the audit", "after audit", "once ", "pending approval",
    "करेंगे", "किया जाएगा", "जल्द",
]
# A "no response" concern is only answered by a sentence about communicating.
COMMUNICATION_CUES = [
    "reply", "replied", "respond", "responded", "communicated", "informed", "written", "letter", "met ",
    "meeting", "contacted", "called", "email", "grievance cell", "counselled", "जवाब", "सूचित", "पत्र",
]
COMMUNICATION_CONCERNS = {"Response from the institute"}

DISPUTE_CUES = [
    "baseless", "false", "denies", "deny", "no record", "not received any", "not our", "not responsible",
    "as per rules", "non-refundable", "not refundable", "misleading", "निराधार", "गलत",
]

# Concern label + the evidence an officer would expect for a completed action.
# Most specific topics first: a concern mentioning several topics takes the
# first match ("caution deposit not refunded" is about the deposit).
CONCERN_RULES: list[tuple[str, str, dict | None]] = [
    ("caution_deposit", "Refund of caution deposit", {"type": "payment_proof", "label": "Payment proof", "keywords": ["utr", "transaction", "neft"]}),
    ("documents", "Return of original documents", {"type": "acknowledgement", "label": "Signed acknowledgement of documents returned", "keywords": ["acknowledg", "signed", "received by"]}),
    ("degree", "Issue of degree / certificate", {"type": "acknowledgement", "label": "Dispatch or receipt record", "keywords": ["dispatch", "acknowledg", "speed post"]}),
    ("ragging", "Action on ragging / harassment", {"type": "committee_report", "label": "Anti-ragging committee action report", "keywords": ["committee", "minutes", "fir", "action report"]}),
    ("scholarship", "Scholarship disbursal", {"type": "payment_proof", "label": "Disbursal proof", "keywords": ["utr", "transaction", "credited"]}),
    ("salary", "Payment of salaries", {"type": "payment_proof", "label": "Salary payment proof", "keywords": ["utr", "bank statement", "salary slip"]}),
    ("excess", "Excess / unapproved fee collected", {"type": "payment_proof", "label": "Refund proof or revised fee notice", "keywords": ["utr", "transaction", "fee notice", "circular"]}),
    ("refund", "Refund of fees", {"type": "payment_proof", "label": "Payment proof (UTR / bank statement)", "keywords": ["utr", "transaction", "neft", "rtgs", "imps", "cheque", "bank statement", "receipt no"]}),
    ("hostel", "Hostel conditions", {"type": "inspection_report", "label": "Inspection report or photographs", "keywords": ["inspection", "photo", "report"]}),
    ("water", "Water supply", {"type": "inspection_report", "label": "Inspection report or photographs", "keywords": ["inspection", "photo", "report"]}),
    ("hygiene", "Hygiene / cleanliness", {"type": "inspection_report", "label": "Inspection report or photographs", "keywords": ["inspection", "photo", "report"]}),
    ("laboratory", "Laboratory facilities", {"type": "inspection_report", "label": "Equipment purchase / inspection record", "keywords": ["invoice", "purchase", "inspection"]}),
    ("faculty", "Faculty strength", {"type": "official_letter", "label": "Faculty appointment records", "keywords": ["appointment", "joining"]}),
    ("approval", "Approval / intake compliance", {"type": "official_letter", "label": "Approval or compliance letter", "keywords": ["approval letter", "compliance", "eoa"]}),
    ("admission", "Admission status", {"type": "official_letter", "label": "Written admission / cancellation order", "keywords": ["order", "letter"]}),
    ("no_response", "Response from the institute", None),
    ("accounts_office", "Response from the institute", None),
    ("delay", "Delay in action", None),
]

_BOUNDARY = re.compile(r"(?<=[.!?।;])\s+|\n+")
_CLAUSE = re.compile(r",\s+and\s+|,\s+but\s+|\s+लेकिन\s+|\s+और\s+")
_ABBREV = ("rs.", "no.", "dr.", "mr.", "ms.", "st.", "sr.", "jr.", "b.", "m.")
# A transaction reference such as "UTR 2026101500123" or "txn id ABC123456".
_TXN_REF = re.compile(r"\b(?:utr|txn|transaction(?:\s+(?:id|no\.?|number))?|ref(?:erence)?\s*no\.?)\W{0,3}[a-z0-9]{6,}", re.I)
_AMOUNT = re.compile(r"(?:rs\.?|inr|₹|rupees)\s*([0-9][0-9,]*(?:\.\d+)?)|([0-9][0-9,]*(?:\.\d+)?)\s*(?:rupees|रुपये)", re.I)


@dataclass
class Span:
    text: str
    start: int
    end: int


@dataclass
class Concern:
    id: str
    label: str
    text: str
    start: int
    end: int
    concepts: list[str]
    status: str = "not_addressed"
    reason: str = ""
    response_span: Span | None = None
    similarity: float | None = None
    expected_evidence: str | None = None
    evidence_found: list[str] = field(default_factory=list)
    missing_evidence: bool = False


def _has(text: str, cues: list[str]) -> list[str]:
    """Cues found in text. Latin cues match at a word start (short ones as whole
    words), so "no" does not fire on "now" or "know"."""
    low = f" {text.lower()} "
    hits = []
    for cue in cues:
        if not cue.isascii():
            if cue in low:
                hits.append(cue)
            continue
        word = cue.strip()
        tail = r"(?![a-z])" if len(word) <= 4 else ""
        if re.search(r"(?<![a-z])" + re.escape(word) + tail, low):
            hits.append(cue)
    return hits


_FUTURE = re.compile(r"\b(?:will|shall|would|to|being|be)\s+(?:be\s+)?$", re.I)


def _done(text: str) -> list[str]:
    """Completed-action cues, ignoring future tense: "will be processed" is a
    promise, not a refund that happened."""
    low = text.lower()
    hits = []
    for cue in _has(text, COMPLETED_CUES):
        i = low.find(cue.strip())
        if i >= 0 and _FUTURE.search(low[max(0, i - 16) : i]):
            continue
        hits.append(cue)
    return hits


def segments(text: str) -> list[Span]:
    """Sentence spans with offsets; avoids splitting after common abbreviations."""
    spans: list[Span] = []
    start = 0
    for m in _BOUNDARY.finditer(text):
        before = text[max(0, m.start() - 4) : m.start()].lower()
        if before.endswith(_ABBREV) and m.group(0).strip() == "":
            continue
        spans.append(Span(text[start : m.start()], start, m.start()))
        start = m.end()
    spans.append(Span(text[start:], start, len(text)))
    out = []
    for s in spans:
        stripped = s.text.strip()
        if not stripped:
            continue
        offset = s.start + s.text.index(stripped)
        out.append(Span(stripped, offset, offset + len(stripped)))
    return out


def _clauses(sentence: Span) -> list[Span]:
    parts: list[Span] = []
    last = 0
    for m in _CLAUSE.finditer(sentence.text):
        parts.append(Span(sentence.text[last : m.start()], sentence.start + last, sentence.start + m.start()))
        last = m.end()
    parts.append(Span(sentence.text[last:], sentence.start + last, sentence.end))
    # Only split when every clause is itself a grievance; otherwise keep the sentence whole.
    if len(parts) > 1 and all(_has(p.text, GRIEVANCE_CUES) and lexicon.analyse(p.text)[1] for p in parts):
        return [Span(p.text.strip(" ,"), p.start, p.end) for p in parts]
    return [sentence]


def _label(concepts) -> tuple[str, dict | None]:
    for concept, label, evidence in CONCERN_RULES:
        if concept in concepts:
            return label, evidence
    return "Concern raised in complaint", None


def extract_concerns(complaint: str) -> list[Concern]:
    concerns: list[Concern] = []
    for sentence in segments(complaint):
        for clause in _clauses(sentence):
            _, concepts = lexicon.analyse(clause.text)
            strong = concepts - lexicon.WEAK_CONCEPTS
            if not _has(clause.text, GRIEVANCE_CUES) or not (strong or "no_response" in concepts):
                continue
            label, _ = _label(concepts)
            concerns.append(
                Concern(
                    id=f"c{len(concerns) + 1}",
                    label=label,
                    text=clause.text,
                    start=clause.start,
                    end=clause.end,
                    concepts=sorted(concepts),
                )
            )
    if not concerns and complaint.strip():
        # Fall back to treating the whole complaint as one concern.
        _, concepts = lexicon.analyse(complaint)
        label, _ = _label(concepts)
        text = complaint.strip()
        start = complaint.index(text)
        concerns.append(Concern("c1", label, text, start, start + len(text), sorted(concepts)))
    return concerns


def _amounts(text: str) -> set[int]:
    vals = set()
    for m in _AMOUNT.finditer(text):
        raw = (m.group(1) or m.group(2) or "").replace(",", "")
        try:
            v = int(float(raw))
        except ValueError:
            continue
        if v >= 100:
            vals.add(v)
    return vals


def check(engine, complaint: str, response: str, evidence: list[dict]) -> dict:
    concerns = extract_concerns(complaint)
    resp_sents = segments(response)
    evidence_types = {e.get("type") for e in evidence}
    attachment_text = " ".join(f"{e.get('type', '')} {e.get('reference', '')}" for e in evidence).lower()

    match_threshold = engine.threshold * 0.75

    for c in concerns:
        label, expected = _label(set(c.concepts))
        c.expected_evidence = expected["label"] if expected else None
        if not resp_sents:
            c.reason = "The response is empty."
            continue

        scored = engine.score(c.text, [(str(i), s.text) for i, s in enumerate(resp_sents)])
        best = None
        for m in scored:
            if label in COMMUNICATION_CONCERNS and not _has(resp_sents[int(m.id)].text, COMMUNICATION_CUES):
                continue
            shared_strong = [t for t in m.shared_terms if t.replace(" ", "_") not in lexicon.WEAK_CONCEPTS]
            ok = m.score >= engine.threshold or (shared_strong and m.score >= match_threshold * 0.6)
            if ok and (best is None or m.score > best.score):
                best = m
        if best is None:
            c.reason = "No part of the response addresses this concern."
            continue

        span = resp_sents[int(best.id)]
        c.response_span = span
        c.similarity = round(best.score, 3)
        # Other response sentences on the same topic can add a promise or a dispute
        # (e.g. "the remaining amount will be refunded later").
        topic = set(c.concepts) - lexicon.WEAK_CONCEPTS
        related = [s for s in resp_sents if s is span or topic & lexicon.analyse(s.text)[1]]
        completed = _done(span.text)
        promised = [cue for s in related for cue in _has(s.text, PROMISE_CUES)]
        disputed = [cue for s in related for cue in _has(s.text, DISPUTE_CUES)]

        if expected:
            found = (
                expected["type"] in evidence_types
                or any(k in attachment_text for k in expected["keywords"])
                or (expected["type"] == "payment_proof" and _TXN_REF.search(response))
            )
            if found:
                c.evidence_found = [expected["label"]]

        if disputed:
            c.status = "partial"
            c.reason = "The response disputes this concern; verify the institution's claim against the complaint."
        elif promised and not completed:
            c.status = "partial"
            c.reason = f"Only a promise of future action (“{promised[0].strip()}”); no completed action is stated."
        elif completed and promised:
            c.status = "partial"
            c.reason = f"Some action is reported as done, but part of it is only promised for later (“{promised[0].strip()}”)."
            if expected and not c.evidence_found:
                c.missing_evidence = True
                c.reason += f" No supporting evidence was provided ({expected['label']})."
        elif completed:
            if expected and not c.evidence_found:
                c.status = "partial"
                c.missing_evidence = True
                c.reason = f"Action is claimed but no supporting evidence was provided ({expected['label']})."
            else:
                c.status = "addressed"
                c.reason = "The response states a completed action for this concern."
        else:
            c.status = "partial"
            c.reason = "The response mentions this concern but does not state a clear action."

        if expected and c.status != "addressed" and not c.evidence_found and not c.missing_evidence and completed:
            c.missing_evidence = True

    inconsistencies = []
    complaint_amounts, response_amounts = _amounts(complaint), _amounts(response)
    if complaint_amounts and response_amounts and not (complaint_amounts & response_amounts):
        fmt = lambda s: ", ".join(f"Rs {v:,}" for v in sorted(s))  # noqa: E731
        inconsistencies.append(
            {
                "type": "amount_mismatch",
                "detail": f"Complaint mentions {fmt(complaint_amounts)} but the response mentions {fmt(response_amounts)}.",
            }
        )
    if not evidence and any(c.expected_evidence for c in concerns):
        inconsistencies.append({"type": "no_evidence", "detail": "No supporting evidence was attached to the response."})

    summary = {
        "total": len(concerns),
        "addressed": sum(c.status == "addressed" for c in concerns),
        "partial": sum(c.status == "partial" for c in concerns),
        "not_addressed": sum(c.status == "not_addressed" for c in concerns),
    }
    gaps = summary["partial"] + summary["not_addressed"] + len(inconsistencies)
    return {
        "mode": engine.mode,
        "model": engine.model,
        "concerns": [_serialize(c) for c in concerns],
        "inconsistencies": inconsistencies,
        "summary": summary,
        "recommendation": "further_review" if gaps else "no_gaps_found",
    }


def _serialize(c: Concern) -> dict:
    d = asdict(c)
    d["response_span"] = asdict(c.response_span) if c.response_span else None
    return d
