"""Bilingual (English / Hindi / Hinglish) concept lexicon for grievance text.

Each concept maps surface forms in several languages to one canonical label.
It powers two things:
  * explainability — the "shared concepts" shown on every evidence card, in
    both the lexicon and the transformer engines;
  * the lightweight fallback engine, which compares complaints by concept so
    "फीस वापसी" and "fee refund" still match without a neural model.
"""

from __future__ import annotations

import re

CONCEPTS: dict[str, list[str]] = {
    "fee": ["fee", "fees", "tuition", "शुल्क", "फीस", "ट्यूशन", "paisa", "paise", "रुपये", "rupees", "rs"],
    "refund": ["refund", "refunded", "refunds", "reimburse", "repay", "returned", "वापसी", "वापस", "लौटाया", "लौटाई", "wapas", "vapas", "wapis"],
    "withdrawal": ["withdraw", "withdrew", "withdrawn", "withdrawal", "cancel", "cancelled", "cancellation", "छोड़", "रद्द"],
    "admission": ["admission", "admitted", "admissions", "enrolment", "enrollment", "प्रवेश", "दाखिला", "admit"],
    "documents": ["document", "documents", "certificate", "certificates", "marksheet", "marksheets", "दस्तावेज़", "दस्तावेज", "प्रमाणपत्र", "प्रमाण", "मार्कशीट", "kagaz"],
    "withheld": ["withheld", "withholding", "retain", "retains", "retained", "retention", "refusing", "kept", "रोक", "रोके", "रखे"],
    "excess": ["excess", "additional", "extra", "beyond", "over", "अतिरिक्त", "ज़्यादा", "ज्यादा", "अधिक"],
    "development_fee": ["development", "विकास"],
    "receipt": ["receipt", "receipts", "रसीद"],
    "hostel": ["hostel", "hostels", "mess", "warden", "छात्रावास", "हॉस्टल", "मेस"],
    "water": ["water", "पानी", "जल", "paani", "pani"],
    "hygiene": ["hygiene", "clean", "cleaned", "dirty", "unhygienic", "सफाई", "गंदगी", "safai"],
    "ragging": ["ragging", "ragged", "rag", "bullying", "harass", "harassing", "harassment", "harassed", "रैगिंग", "उत्पीड़न", "परेशान"],
    "senior_students": ["senior", "seniors", "वरिष्ठ"],
    "anti_ragging_committee": ["anti-ragging", "antiragging", "committee", "समिति", "एंटी-रैगिंग"],
    "faculty": ["faculty", "teacher", "teachers", "lecturer", "lecturers", "professor", "शिक्षक", "अध्यापक", "प्राध्यापक"],
    "salary": ["salary", "salaries", "wages", "वेतन", "तनख्वाह", "tankhwah"],
    "scholarship": ["scholarship", "scholarships", "छात्रवृत्ति", "वजीफा"],
    "laboratory": ["lab", "labs", "laboratory", "laboratories", "प्रयोगशाला", "लैब"],
    "equipment": ["equipment", "instruments", "उपकरण"],
    "approval": ["approval", "approved", "unapproved", "approve", "मान्यता", "स्वीकृत", "स्वीकृति", "अनुमोदन"],
    "intake": ["intake", "seats", "seat", "सीट", "सीटें"],
    "course": ["course", "programme", "program", "b.tech", "btech", "m.tech", "mtech", "पाठ्यक्रम", "कोर्स", "बी.टेक", "टेक"],
    "no_response": ["response", "reply", "replied", "answer", "जवाब", "उत्तर", "कार्रवाई", "action"],
    "delay": ["delay", "delayed", "pending", "months", "month", "still", "महीने", "महीना", "देरी", "लंबित", "mahine", "mahina", "सप्ताह"],
    "accounts_office": ["accounts", "accountant", "लेखा", "अकाउंट"],
    "student": ["student", "students", "छात्र", "छात्रों", "विद्यार्थी"],
    "institute": ["institute", "institution", "college", "संस्थान", "कॉलेज", "महाविद्यालय"],
    "degree": ["degree", "provisional", "डिग्री", "उपाधि"],
    "caution_deposit": ["caution", "deposit", "security", "जमानत"],
}

# Concepts too generic to count as shared evidence on their own.
WEAK_CONCEPTS = {"student", "institute", "course", "delay", "no_response"}

STOPWORDS = {
    # English
    "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "by", "is", "are", "was", "were",
    "be", "been", "has", "have", "had", "my", "our", "me", "we", "i", "it", "its", "this", "that", "these",
    "they", "them", "their", "not", "no", "from", "at", "as", "but", "after", "before", "even", "all", "any",
    "keeps", "asking", "come", "back", "later", "so", "per", "year", "years", "also", "only", "about", "into",
    # Hindi
    "का", "की", "के", "को", "में", "से", "है", "हैं", "था", "थे", "थी", "और", "पर", "ने", "भी", "हो", "गए",
    "गया", "कर", "दिए", "दिया", "रहा", "रहे", "रही", "लेकिन", "कोई", "नहीं", "मैंने", "मेरी", "मेरा", "हमारे",
    "हमसे", "तक", "अब", "लिए", "लेने", "बाद", "ले", "लिया", "देता", "जाती", "जाता", "किया", "करते", "द्वारा", "नाम",
}

_SURFACE_TO_CONCEPT: dict[str, str] = {}
for concept, forms in CONCEPTS.items():
    for form in forms:
        _SURFACE_TO_CONCEPT.setdefault(form.lower(), concept)

_TOKEN = re.compile(r"[a-z0-9][a-z0-9.\-]*[a-z0-9]|[a-z0-9]|[ऀ-ॣ०-ॿ]+")
_EN_SUFFIXES = ("ing", "ed", "es", "s")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in STOPWORDS]


def concept_of(token: str) -> str | None:
    if token in _SURFACE_TO_CONCEPT:
        return _SURFACE_TO_CONCEPT[token]
    if token.isascii():
        for suffix in _EN_SUFFIXES:
            if token.endswith(suffix) and len(token) - len(suffix) >= 3:
                stem = token[: -len(suffix)]
                if stem in _SURFACE_TO_CONCEPT:
                    return _SURFACE_TO_CONCEPT[stem]
    else:
        # Hindi words often carry attached inflections; match on known prefixes.
        for form, concept in _SURFACE_TO_CONCEPT.items():
            if not form.isascii() and len(form) >= 3 and token.startswith(form):
                return concept
    return None


def analyse(text: str) -> tuple[list[str], set[str]]:
    """Returns (features, concepts). Features are concept ids where known and
    raw tokens otherwise, so same-language wording still contributes."""
    features: list[str] = []
    concepts: set[str] = set()
    for tok in tokenize(text):
        c = concept_of(tok)
        if c:
            features.append(f"c:{c}")
            concepts.add(c)
        elif len(tok) > 2 and not tok.isdigit():
            features.append(f"w:{tok}")
    return features, concepts


def label(concept: str) -> str:
    return concept.replace("_", " ")


def shared_concepts(a: set[str], b: set[str]) -> list[str]:
    shared = a & b
    strong = sorted(c for c in shared if c not in WEAK_CONCEPTS)
    weak = sorted(c for c in shared if c in WEAK_CONCEPTS)
    return [label(c) for c in strong + weak]
