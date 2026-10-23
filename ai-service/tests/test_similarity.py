from app.engine import LexiconEngine
from app.lexicon import analyse

EN_REFUND = (
    "Fee refund not processed after withdrawal of admission. I withdrew my admission from the B.Tech "
    "programme and submitted the refund form with all documents. The institute has not refunded my tuition fee."
)
HI_REFUND = (
    "प्रवेश वापस लेने के बाद फीस वापसी नहीं. मैंने अगस्त में बी.टेक में प्रवेश वापस ले लिया था और सभी दस्तावेज़ "
    "जमा कर दिए थे। तीन महीने हो गए लेकिन संस्थान ने मेरी ट्यूशन फीस वापस नहीं की है।"
)
HOSTEL = "Hostel mess hygiene and water supply. The boys hostel has had irregular drinking water supply."


def test_hindi_maps_to_english_concepts():
    _, concepts = analyse(HI_REFUND)
    assert {"fee", "refund", "admission", "documents"} <= concepts


def test_cross_language_refund_beats_unrelated():
    engine = LexiconEngine()
    results = {m.id: m for m in engine.score(HI_REFUND, [("refund", EN_REFUND), ("hostel", HOSTEL)])}
    assert results["refund"].score >= engine.threshold
    assert results["hostel"].score < engine.threshold
    assert "fee" in results["refund"].shared_terms
    assert "refund" in results["refund"].shared_terms
