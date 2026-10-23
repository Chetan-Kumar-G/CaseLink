"""Synthetic, labelled evaluation data for CaseLink.

Each institution has several *issue groups* (one underlying problem, e.g.
"withholds tuition refunds after withdrawal"). Complaints in the same group are
ground-truth related; complaints in different groups are not — including pairs
that share a category (e.g. tuition refund vs caution-deposit refund), which
is exactly where the rule layer over-matches.

Complaints vary by bureau, channel, language (English / Hindi / Hinglish),
wording and date. A few complainants file the same complaint twice with the
same email (ground-truth duplicates).

Limitation: the templates were written by the same team as the matcher, so
scores here are an optimistic upper bound. Real complaints, labelled by
officers, are needed for a fair measurement.
"""

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass

BUREAUS = ["PGRC", "RB", "AB"]
CHANNELS = ["portal", "email", "cpgrams", "letter"]

# issue type -> category, English / Hindi / Hinglish templates, and the
# ClosureGuard concern label it should produce.
ISSUES = {
    "tuition_refund": {
        "category": "fee_refund",
        "label": "Refund of fees",
        "en": [
            "I withdrew my admission in {month} but the institute has not refunded my tuition fee of Rs {amount} even after {n} months.",
            "The college is not returning the fee paid for the {prog} seat I cancelled. Refund of Rs {amount} is still pending.",
            "After cancelling my admission I applied for a refund, but the institute keeps delaying the fee refund for {n} months.",
        ],
        "hi": [
            "मैंने {month} में प्रवेश वापस ले लिया था लेकिन संस्थान ने मेरी ट्यूशन फीस वापस नहीं की है।",
            "प्रवेश रद्द करने के बाद भी कॉलेज ने {amount} रुपये की फीस वापस नहीं की है।",
        ],
        "mix": ["Admission cancel karne ke baad bhi college ne fees wapas nahi ki hai, {n} mahine ho gaye."],
        "fix": "The full tuition fee of Rs {amount} has been refunded to the student by NEFT.",
        "promise": "The tuition fee will be refunded after the audit of accounts is completed.",
        "evidence": {"type": "payment_proof", "reference": "UTR 2026{n}0000{amount}"},
    },
    "caution_refund": {
        "category": "fee_refund",
        "label": "Refund of caution deposit",
        "en": [
            "I completed my {prog} last year but the caution deposit has not been refunded yet.",
            "Caution money of Rs {amount} is pending with the institute for {n} months after graduation.",
        ],
        "hi": ["डिग्री पूरी होने के बाद भी जमानत राशि वापस नहीं की गई है।"],
        "mix": ["Caution deposit abhi tak wapas nahi mila, {n} mahine ho gaye."],
        "fix": "The caution deposit has been refunded to the student by NEFT.",
        "promise": "The caution deposit will be refunded next month.",
        "evidence": {"type": "payment_proof", "reference": "UTR 77{amount}"},
    },
    "certificates": {
        "category": "certificates",
        "label": "Return of original documents",
        "en": [
            "The college is refusing to return my original certificates unless I pay fees for the full course.",
            "My original marksheets are withheld by the institute after I took a transfer.",
        ],
        "hi": ["संस्थान मेरे मूल प्रमाणपत्र वापस नहीं कर रहा है और पूरे कोर्स की फीस मांग रहा है।"],
        "mix": ["College original documents wapas nahi kar raha, poori fees maang raha hai."],
        "fix": "All original certificates have been returned to the student and a signed acknowledgement obtained.",
        "promise": "The certificates will be returned once the dues are verified.",
        "evidence": {"type": "acknowledgement", "reference": "Acknowledgement dated 12 Oct"},
    },
    "ragging": {
        "category": "harassment",
        "label": "Action on ragging / harassment",
        "en": [
            "First-year students are being ragged by seniors in the hostel and the anti-ragging committee has not acted.",
            "Seniors are harassing new students at night in the hostel; no action has been taken on our complaint.",
        ],
        "hi": ["छात्रावास में वरिष्ठ छात्र नए छात्रों की रैगिंग करते हैं और समिति ने कोई कार्रवाई नहीं की है।"],
        "mix": ["Hostel mein seniors ragging kar rahe hain, committee ne koi action nahi liya."],
        "fix": "The anti-ragging committee met, and the three students involved have been suspended from the hostel.",
        "promise": "The anti-ragging committee will meet next week to look into the matter.",
        "evidence": {"type": "committee_report", "reference": "Committee minutes"},
    },
    "hostel_water": {
        "category": "hostel",
        "label": "Hostel conditions",
        "en": [
            "There has been no drinking water supply in the hostel for {n} weeks and the mess is not cleaned.",
            "Hostel water supply is irregular and the mess kitchen is unhygienic; students have fallen ill.",
        ],
        "hi": ["छात्रावास में {n} सप्ताह से पीने का पानी नहीं है और मेस की सफाई नहीं होती।"],
        "mix": ["Hostel mein paani nahi aa raha aur mess ki safai nahi hoti."],
        "fix": "The hostel water supply has been restored and the mess kitchen has been cleaned; an inspection report is attached.",
        "promise": "A new water tank will be installed shortly.",
        "evidence": {"type": "inspection_report", "reference": "Inspection report"},
    },
    "excess_fee": {
        "category": "excess_fee",
        "label": "Excess / unapproved fee collected",
        "en": [
            "The institute is collecting an extra development fee of Rs {amount} beyond the approved fee without receipts.",
            "We are being charged an additional fee of Rs {amount} over the approved fee structure.",
        ],
        "hi": ["संस्थान स्वीकृत शुल्क के अलावा {amount} रुपये अतिरिक्त विकास शुल्क ले रहा है।"],
        "mix": ["College approved fees ke upar extra development fee le raha hai."],
        "fix": "The extra development fee has been refunded to all students and a revised fee notice issued.",
        "promise": "The extra fee will be adjusted in the next semester.",
        "evidence": {"type": "payment_proof", "reference": "Fee notice and UTR list"},
    },
    "salary": {
        "category": "faculty",
        "label": "Payment of salaries",
        "en": [
            "Faculty salaries have not been paid for {n} months and teachers are resigning.",
            "Teachers at the institute have not received salary for {n} months.",
        ],
        "hi": ["शिक्षकों को {n} महीने से वेतन नहीं मिला है।"],
        "mix": ["Teachers ko {n} mahine se salary nahi mili."],
        "fix": "All pending salaries have been paid to the faculty; bank statements are attached.",
        "promise": "Pending salaries will be paid after the fee collection.",
        "evidence": {"type": "payment_proof", "reference": "Bank statement"},
    },
    "unapproved_course": {
        "category": "approval",
        "label": "Approval / intake compliance",
        "en": [
            "The institute admitted us to an {prog} programme that does not have approval.",
            "Our {prog} course is running without approval and the institute is still collecting fees.",
        ],
        "hi": ["संस्थान ने बिना मान्यता वाले {prog} कोर्स में प्रवेश दिया है।"],
        "mix": ["{prog} course ki approval nahi hai phir bhi admission diya gaya."],
        "fix": "The approval letter for the programme has been issued and a compliance report submitted.",
        "promise": "Approval for the programme will be sought next year.",
        "evidence": {"type": "official_letter", "reference": "Approval letter"},
    },
}

MONTHS = ["July", "August", "September"]
MONTHS_HI = ["जुलाई", "अगस्त", "सितंबर"]
PROGS = ["B.Tech", "M.Tech", "MBA", "B.Pharm", "Diploma"]
DISTRACTOR_RESPONSE = "The institute has organised a cultural festival and sports week for all students this semester."


@dataclass
class Complaint:
    id: str
    institution: str
    group: str
    issue: str
    category: str
    bureau: str
    channel: str
    language: str
    day: int  # days since dataset start
    email: str
    text: str


AMOUNTS = ["45,000", "60,000", "85,000", "15,000", "10,000"]


def _fill(tpl: str, rng: random.Random, lang: str, amount: str | None = None) -> str:
    return tpl.format(
        month=rng.choice(MONTHS_HI if lang == "hi" else MONTHS),
        amount=amount or rng.choice(AMOUNTS),
        n=rng.choice([2, 3, 4, 5]),
        prog=rng.choice(PROGS),
    )


def build_cases(n_institutions: int = 48, seed: int = 42) -> list[Complaint]:
    rng = random.Random(seed)
    cases: list[Complaint] = []
    issue_names = list(ISSUES)
    for i in range(n_institutions):
        inst = f"1-9{i:05d}0000"
        n_groups = rng.randint(3, 5)
        chosen = rng.sample(issue_names, n_groups)
        # Sometimes add both refund kinds: same category, different issue.
        if "tuition_refund" in chosen and "caution_refund" not in chosen and rng.random() < 0.4:
            chosen.append("caution_refund")
        for g, issue in enumerate(chosen):
            spec = ISSUES[issue]
            group = f"{inst}:{g}"
            start = rng.randint(0, 200)
            for k in range(rng.randint(1, 4)):
                lang = rng.choices(["en", "hi", "mix"], weights=[0.6, 0.25, 0.15])[0]
                text = _fill(rng.choice(spec[lang]), rng, lang)
                email = f"student{len(cases)}@example.com"
                c = Complaint(
                    id=f"c{len(cases):04d}",
                    institution=inst,
                    group=group,
                    issue=issue,
                    category=spec["category"],
                    bureau=rng.choice(BUREAUS),
                    channel=rng.choice(CHANNELS),
                    language=lang,
                    day=start + rng.randint(0, 80) + k,
                    email=email,
                    text=text,
                )
                cases.append(c)
                # ~6% of complainants re-file the same complaint with another bureau.
                if rng.random() < 0.06:
                    dup = Complaint(**{**asdict(c), "id": f"c{len(cases):04d}", "bureau": rng.choice([b for b in BUREAUS if b != c.bureau]), "day": c.day + rng.randint(3, 20)})
                    cases.append(dup)
    return cases


def build_closure_cases(cases: list[Complaint], n: int = 160, seed: int = 7) -> list[dict]:
    """Complaint + response pairs with the expected verdict for the main concern."""
    rng = random.Random(seed)
    kinds = ["full", "promise", "no_evidence", "ignore"]
    out = []
    for c in rng.sample(cases, min(n, len(cases))):
        spec = ISSUES[c.issue]
        kind = rng.choice(kinds)
        # Reuse the complaint's amount so a correct reply is not flagged as a mismatch.
        amount = next((a for a in AMOUNTS if a in c.text), None)
        fix = _fill(spec["fix"], rng, "en", amount)
        if kind == "full":
            response, evidence, expected = fix, [spec["evidence"]], "addressed"
        elif kind == "promise":
            response, evidence, expected = spec["promise"], [], "partial"
        elif kind == "no_evidence":
            response, evidence, expected = fix, [], "partial"
        else:
            response, evidence, expected = DISTRACTOR_RESPONSE, [], "not_addressed"
        out.append(
            {
                "id": c.id,
                "language": c.language,
                "issue": c.issue,
                "label": spec["label"],
                "complaint": c.text,
                "response": response,
                "evidence": evidence,
                "kind": kind,
                "expected": expected,
            }
        )
    return out


if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).parent / "data"
    out.mkdir(exist_ok=True)
    cases = build_cases()
    (out / "cases.jsonl").write_text("\n".join(json.dumps(asdict(c), ensure_ascii=False) for c in cases), encoding="utf-8")
    closure = build_closure_cases(cases)
    (out / "closure.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in closure), encoding="utf-8")
    print(f"wrote {len(cases)} cases and {len(closure)} closure pairs to {out}")
