"""Promise extraction for the Promise Ledger.

When an institution cannot fix a problem it rarely refuses — it promises
("refund will be processed within 30 days", "certificate will be issued after
verification", "matter is under consideration of the management"). Each such
commitment is pulled out of the reply as a ledger entry:

    action · amount · deadline · condition · exact text span

A "stall" is a commitment with no concrete action at all (under consideration,
being examined). Deadlines are resolved against the date the reply was
received. Everything is rule-based and quotes the institution's own words, so
an officer can always see why an entry was created.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

from . import lexicon
from .closure import CONCERN_RULES, PROMISE_CUES, _amounts, _has, segments

STALL_CUES = [
    "under consideration", "under the consideration", "being considered", "being examined", "under examination",
    "will be looked into", "will look into", "looking into", "will be considered", "under review of",
    "matter is under", "being processed at", "is being reviewed", "will be taken up", "विचाराधीन", "देखा जा रहा",
]
EXTRA_PROMISE_CUES = ["within", "by the end", "on or before", "दिनों में", "दिन में", "महीने में"]

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}

_WITHIN = re.compile(r"\b(?:within|in|after)\s+(?:the\s+next\s+)?(\d{1,3})\s*(working\s+days?|days?|weeks?|months?)", re.I)
_HINDI_WITHIN = re.compile(r"(\d{1,3})\s*(दिनों|दिन|सप्ताह|महीने|महीनों)")
_BY_DATE = re.compile(
    r"\b(?:by|before|on or before|till|until)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*(\d{4}))?",
    re.I,
)
_BY_NUMERIC = re.compile(r"\b(?:by|before|on or before|till|until)\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", re.I)
_RELATIVE = [
    (re.compile(r"\bnext week\b", re.I), 7),
    (re.compile(r"\bnext month\b", re.I), 30),
    (re.compile(r"\b(?:end of (?:this|the) month|this month)\b", re.I), None),  # resolved to month end
    (re.compile(r"अगले सप्ताह"), 7),
    (re.compile(r"अगले महीने"), 30),
]
_CONDITION = re.compile(
    r"\b(?:after|once|upon|subject to|on completion of|on receipt of)\s+(?:the\s+)?([a-z][a-z\s]{2,40}?)(?=[,.;]|\s+(?:is|are|has|have|within|by)\b|$)",
    re.I,
)
_VAGUE = re.compile(r"\b(?:soon|shortly|at the earliest|in due course|as early as possible|जल्द)\b", re.I)


def _action(text: str) -> tuple[str, str | None]:
    _, concepts = lexicon.analyse(text)
    for concept, label, _ in CONCERN_RULES:
        if concept in concepts and concept not in {"no_response", "accounts_office", "delay"}:
            return label, concept
    return "Action promised", None


def _deadline(text: str, received: date) -> tuple[date | None, str | None]:
    m = _WITHIN.search(text)
    if m:
        n, unit = int(m.group(1)), m.group(2).lower()
        if unit.startswith("week"):
            days = n * 7
        elif unit.startswith("month"):
            days = n * 30
        elif unit.startswith("working"):
            days = round(n * 7 / 5)
        else:
            days = n
        return received + timedelta(days=days), m.group(0)
    m = _HINDI_WITHIN.search(text)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        days = n * (7 if unit == "सप्ताह" else 30 if unit.startswith("मही") else 1)
        return received + timedelta(days=days), m.group(0)
    m = _BY_DATE.search(text)
    if m:
        day, month = int(m.group(1)), MONTHS[m.group(2).lower()[:3]]
        year = int(m.group(3)) if m.group(3) else received.year
        try:
            d = date(year, month, day)
        except ValueError:
            return None, None
        if not m.group(3) and d < received:
            d = date(year + 1, month, day)
        return d, m.group(0)
    m = _BY_NUMERIC.search(text)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        year = year + 2000 if year < 100 else year
        try:
            return date(year, month, day), m.group(0)
        except ValueError:
            return None, None
    for rx, days in _RELATIVE:
        m = rx.search(text)
        if m:
            if days is None:
                nxt = (received.replace(day=1) + timedelta(days=32)).replace(day=1)
                return nxt - timedelta(days=1), m.group(0)
            return received + timedelta(days=days), m.group(0)
    return None, None


def extract_promises(response: str, received: date | None = None) -> list[dict]:
    received = received or date.today()
    out: list[dict] = []
    for span in segments(response):
        text = span.text
        stall = _has(text, STALL_CUES)
        promise = _has(text, PROMISE_CUES) or _has(text, EXTRA_PROMISE_CUES)
        if not (stall or promise):
            continue
        deadline, deadline_text = _deadline(text, received)
        if not (stall or deadline or _has(text, PROMISE_CUES)):
            continue  # "within" alone, without a future-tense commitment, is not a promise
        action, concept = _action(text)
        amounts = _amounts(text)
        cond = _CONDITION.search(text)
        condition = cond.group(1).strip() if cond and not (deadline_text and cond.group(0) in deadline_text) else None
        kind = "stall" if stall and concept is None else "commitment"
        out.append(
            {
                "id": f"p{len(out) + 1}",
                "kind": kind,
                "action": "No concrete action (matter kept pending)" if kind == "stall" else action,
                "concept": concept,
                "amount": max(amounts) if amounts else None,
                "deadline": deadline.isoformat() if deadline else None,
                "deadline_text": deadline_text,
                "condition": condition,
                "vague": deadline is None,
                "text": text,
                "start": span.start,
                "end": span.end,
            }
        )
    return out
