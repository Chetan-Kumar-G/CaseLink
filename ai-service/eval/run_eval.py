"""Measures the overlap layers and ClosureGuard on the synthetic labelled set.

    python -m eval.run_eval                 # engine from AI_ENGINE (auto)
    python -m eval.run_eval --engine lexicon

Writes eval/reports/report-<engine>.md and .json. The exact and rule layers
mirror backend/src/services/overlapEngine.js (same-complainant hash; same
category within 120 days); the semantic layer calls the real engine.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import time
from collections import Counter, defaultdict
from dataclasses import asdict
from itertools import combinations

from app.closure import check
from app.engine import LexiconEngine, build_engine

from .dataset import build_cases, build_closure_cases

RULE_WINDOW_DAYS = 120
HERE = pathlib.Path(__file__).parent


def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f, 3), "tp": tp, "fp": fp, "fn": fn}


def eval_overlaps(engine, cases):
    by_inst = defaultdict(list)
    for c in cases:
        by_inst[c.institution].append(c)

    counts = {k: Counter() for k in ("exact", "rule", "semantic", "combined")}
    lang_recall = defaultdict(Counter)
    recall_at_5 = []

    for items in by_inst.values():
        scores = {}
        for c in items:
            others = [o for o in items if o.id != c.id]
            for m in engine.score(c.text, [(o.id, o.text) for o in others]):
                scores[(c.id, m.id)] = m.score
            # Recall@5: of this case's truly related cases, how many rank in its top 5.
            related = {o.id for o in others if o.group == c.group}
            if related:
                ranked = sorted(others, key=lambda o: -scores[(c.id, o.id)])[:5]
                recall_at_5.append(len(related & {o.id for o in ranked}) / min(len(related), 5))

        for a, b in combinations(items, 2):
            truth = a.group == b.group
            pred = {
                "exact": a.email == b.email,
                "rule": a.category == b.category and abs(a.day - b.day) <= RULE_WINDOW_DAYS,
                "semantic": max(scores[(a.id, b.id)], scores[(b.id, a.id)]) >= engine.threshold,
            }
            pred["combined"] = any(pred.values())
            for layer, p in pred.items():
                key = "tp" if p and truth else "fp" if p else "fn" if truth else "tn"
                counts[layer][key] += 1
            if truth:
                pair = "-".join(sorted([a.language, b.language]))
                lang_recall[pair]["total"] += 1
                lang_recall[pair]["found"] += int(pred["semantic"])

    return {
        "layers": {k: prf(v["tp"], v["fp"], v["fn"]) for k, v in counts.items()},
        "semantic_recall_by_language_pair": {k: round(v["found"] / v["total"], 3) for k, v in sorted(lang_recall.items())},
        "semantic_recall_at_5": round(sum(recall_at_5) / len(recall_at_5), 3),
    }


def eval_closure(engine, pairs):
    confusion = Counter()
    by_kind = defaultdict(Counter)
    gap_counts = Counter()
    for p in pairs:
        result = check(engine, p["complaint"], p["response"], p["evidence"])
        main = next((c for c in result["concerns"] if c["label"] == p["label"]), None)
        predicted = main["status"] if main else "concern_missed"
        confusion[(p["expected"], predicted)] += 1
        by_kind[p["kind"]]["total"] += 1
        by_kind[p["kind"]]["correct"] += int(predicted == p["expected"])
        # Case-level: does ClosureGuard recommend further review exactly when the reply is inadequate?
        truth_gap = p["kind"] != "full"
        pred_gap = main is None or main["status"] != "addressed"
        gap_counts["tp" if truth_gap and pred_gap else "fp" if pred_gap else "fn" if truth_gap else "tn"] += 1

    total = len(pairs)
    correct = sum(v for (e, pr), v in confusion.items() if e == pr)
    return {
        "pairs": total,
        "main_concern_accuracy": round(correct / total, 3),
        "concern_missed": sum(v for (e, pr), v in confusion.items() if pr == "concern_missed"),
        "accuracy_by_response_type": {k: round(v["correct"] / v["total"], 3) for k, v in sorted(by_kind.items())},
        "gap_detection": prf(gap_counts["tp"], gap_counts["fp"], gap_counts["fn"]),
        "confusion": {f"{e} -> {pr}": v for (e, pr), v in sorted(confusion.items())},
    }


def write_report(name, data):
    out = HERE / "reports"
    out.mkdir(exist_ok=True)
    (out / f"report-{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    o, c = data["overlap"], data["closure"]
    lines = [
        f"# CaseLink evaluation — {data['engine']['mode']} engine",
        "",
        f"Generated {data['generated']} · {data['dataset']['cases']} synthetic cases across {data['dataset']['institutions']} institutions "
        f"({data['dataset']['pairs']} same-institution pairs, {data['dataset']['related_pairs']} truly related) · "
        f"languages {data['dataset']['languages']} · runtime {data['runtime_s']} s",
        "",
        "> **Read this first.** The data is template-generated by the same team that built the matcher, so these numbers are an",
        "> optimistic upper bound, not a field result. A fair measurement needs real complaints labelled by AICTE officers.",
        "",
        "## Overlap detection (pairs of cases at the same institution)",
        "",
        "| Layer | Precision | Recall | F1 | TP | FP | FN |",
        "|---|---|---|---|---|---|---|",
    ]
    for layer, m in o["layers"].items():
        lines.append(f"| {layer} | {m['precision']} | {m['recall']} | {m['f1']} | {m['tp']} | {m['fp']} | {m['fn']} |")
    lines += [
        "",
        f"Semantic Recall@5 (related cases ranked in a case's top 5): **{o['semantic_recall_at_5']}**",
        "",
        "Semantic recall by language pair: " + ", ".join(f"{k} {v}" for k, v in o["semantic_recall_by_language_pair"].items()),
        "",
        "Every flagged pair goes to an officer, so the combined layer favours recall; precision is the cost in review time.",
        "",
        "## ClosureGuard",
        "",
        f"{c['pairs']} complaint/response pairs with a known verdict for the main concern.",
        "",
        f"- Main-concern verdict accuracy: **{c['main_concern_accuracy']}** (concern not extracted: {c['concern_missed']})",
        f"- Gap detection (should it recommend further review?): precision {c['gap_detection']['precision']}, recall {c['gap_detection']['recall']}, F1 {c['gap_detection']['f1']}",
        "- Accuracy by response type: " + ", ".join(f"{k} {v}" for k, v in c["accuracy_by_response_type"].items()),
        "",
        "| Expected → predicted | Count |",
        "|---|---|",
    ]
    lines += [f"| {k} | {v} |" for k, v in c["confusion"].items()]
    (out / f"report-{name}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out / f"report-{name}.md"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=["auto", "lexicon", "transformer"], default=os.getenv("AI_ENGINE", "auto"))
    args = ap.parse_args()
    engine = LexiconEngine() if args.engine == "lexicon" else (os.environ.update(AI_ENGINE=args.engine) or build_engine())

    cases = build_cases()
    pairs = build_closure_cases(cases)
    by_inst = Counter(c.institution for c in cases)
    groups = Counter(c.group for c in cases)
    t0 = time.time()
    data = {
        "engine": {"mode": engine.mode, "model": engine.model, "threshold": engine.threshold},
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "dataset": {
            "cases": len(cases),
            "institutions": len(by_inst),
            "pairs": sum(n * (n - 1) // 2 for n in by_inst.values()),
            "related_pairs": sum(n * (n - 1) // 2 for n in groups.values()),
            "languages": dict(Counter(c.language for c in cases)),
        },
        "overlap": eval_overlaps(engine, cases),
        "closure": eval_closure(engine, pairs),
    }
    data["runtime_s"] = round(time.time() - t0, 1)
    path = write_report(engine.mode, data)
    print(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
