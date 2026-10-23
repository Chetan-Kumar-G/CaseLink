from app.closure import check, extract_concerns, segments
from app.engine import LexiconEngine

COMPLAINT = (
    "I withdrew my admission from the B.Tech programme in July and submitted the refund form with all documents. "
    "The institute has not refunded my tuition fee of Rs 85,000 even after three months, and the accounts office "
    "keeps asking me to come back later."
)
PARTIAL_RESPONSE = (
    "The institute has processed a refund of Rs 40,000 to the student. "
    "The remaining amount will be refunded after the audit of accounts is completed."
)
FULL_RESPONSE = (
    "The full tuition fee of Rs 85,000 has been refunded to the student by NEFT, UTR 2026101500123. "
    "The accounts office has issued a written reply to the student and the officer concerned has been counselled."
)


def test_segments_keep_abbreviations():
    spans = segments(COMPLAINT)
    assert len(spans) == 2
    assert spans[0].text.startswith("I withdrew") and "B.Tech" in spans[0].text
    assert COMPLAINT[spans[1].start : spans[1].end] == spans[1].text


def test_background_sentence_is_not_a_concern():
    concerns = extract_concerns(COMPLAINT)
    assert all(not c.text.startswith("I withdrew") for c in concerns)
    labels = [c.label for c in concerns]
    assert "Refund of fees" in labels
    assert "Response from the institute" in labels


def test_partial_response_flags_gaps():
    result = check(LexiconEngine(), COMPLAINT, PARTIAL_RESPONSE, [])
    by_label = {c["label"]: c for c in result["concerns"]}
    assert by_label["Refund of fees"]["status"] == "partial"
    assert by_label["Response from the institute"]["status"] == "not_addressed"
    types = {i["type"] for i in result["inconsistencies"]}
    assert "amount_mismatch" in types
    assert result["recommendation"] == "further_review"


def test_full_response_with_evidence_is_addressed():
    evidence = [{"type": "payment_proof", "reference": "UTR 2026101500123"}]
    result = check(LexiconEngine(), COMPLAINT, FULL_RESPONSE, evidence)
    refund = next(c for c in result["concerns"] if c["label"] == "Refund of fees")
    assert refund["status"] == "addressed"
    assert refund["response_span"]["text"].startswith("The full tuition fee")
    assert not any(i["type"] == "amount_mismatch" for i in result["inconsistencies"])


def test_claimed_action_without_evidence_is_partial():
    response = "The tuition fee of Rs 85,000 has been refunded to the student."
    result = check(LexiconEngine(), COMPLAINT, response, [])
    refund = next(c for c in result["concerns"] if c["label"] == "Refund of fees")
    assert refund["status"] == "partial" and refund["missing_evidence"]


def test_hindi_complaint_english_response():
    hindi = "संस्थान ने मेरी ट्यूशन फीस वापस नहीं की है और लेखा विभाग कोई जवाब नहीं देता।"
    result = check(LexiconEngine(), hindi, PARTIAL_RESPONSE, [])
    assert result["summary"]["total"] >= 1
    assert any(c["response_span"] for c in result["concerns"])


def test_promise_in_related_sentence_is_reported():
    result = check(LexiconEngine(), COMPLAINT, PARTIAL_RESPONSE, [])
    refund = next(c for c in result["concerns"] if c["label"] == "Refund of fees")
    assert "promised" in refund["reason"]
    assert refund["missing_evidence"]


def test_future_tense_is_a_promise_not_a_completed_action():
    response = "The refund of Rs 85,000 will be processed within 30 days after approval of the management."
    result = check(LexiconEngine(), COMPLAINT, response, [])
    refund = next(c for c in result["concerns"] if c["label"] == "Refund of fees")
    assert refund["status"] == "partial"
    assert refund["reason"].startswith("Only a promise")
