from datetime import date

from app.promises import extract_promises

RECEIVED = date(2026, 10, 1)


def test_refund_within_days():
    [p] = extract_promises("The balance refund of Rs 40,000 will be processed within 30 days.", RECEIVED)
    assert p["kind"] == "commitment"
    assert p["action"] == "Refund of fees"
    assert p["amount"] == 40000
    assert p["deadline"] == "2026-10-31"
    assert not p["vague"]


def test_certificate_after_verification_is_conditional_and_vague():
    [p] = extract_promises("The certificate will be issued after verification of records.", RECEIVED)
    assert p["action"] == "Return of original documents"
    assert p["condition"].startswith("verification")
    assert p["vague"] and p["deadline"] is None


def test_under_consideration_is_a_stall():
    [p] = extract_promises("The matter is under consideration of the management.", RECEIVED)
    assert p["kind"] == "stall"


def test_explicit_date_and_completed_sentence_ignored():
    out = extract_promises("The first instalment has been refunded. The remaining amount will be paid by 30 Nov.", RECEIVED)
    assert len(out) == 1
    assert out[0]["deadline"] == "2026-11-30"


def test_hindi_days():
    [p] = extract_promises("फीस 15 दिनों में वापस कर दी जाएगी।", RECEIVED)
    assert p["deadline"] == "2026-10-16"
    assert p["action"] == "Refund of fees"


def test_completed_reply_has_no_promises():
    assert extract_promises("The full fee of Rs 85,000 has been refunded by NEFT, UTR 2026101500123.", RECEIVED) == []
