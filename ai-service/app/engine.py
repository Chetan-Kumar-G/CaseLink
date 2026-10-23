"""Similarity engines.

* TransformerEngine — multilingual sentence embeddings
  (paraphrase-multilingual-MiniLM-L12-v2 by default). Used when
  sentence-transformers is installed.
* LexiconEngine — dependency-free fallback: TF-IDF cosine over bilingual
  concepts + raw tokens. Weaker, but keeps the platform working on any laptop.

Both return the same shape so the API layer does not care which one runs.
"""

from __future__ import annotations

import logging
import math
import os
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from . import lexicon

log = logging.getLogger("caselink.ai")


@dataclass
class Match:
    id: str
    score: float
    shared_terms: list[str]


class LexiconEngine:
    mode = "lexicon"
    model = "bilingual-concept-tfidf"

    def __init__(self, threshold: float | None = None) -> None:
        self.threshold = threshold if threshold is not None else 0.30

    def score(self, query: str, candidates: list[tuple[str, str]]) -> list[Match]:
        q_feats, q_concepts = lexicon.analyse(query)
        docs = [(cid, *lexicon.analyse(text)) for cid, text in candidates]

        corpus = [q_feats] + [f for _, f, _ in docs]
        n = len(corpus)
        df: Counter[str] = Counter()
        for feats in corpus:
            df.update(set(feats))
        idf = {t: math.log((1 + n) / (1 + d)) + 1 for t, d in df.items()}

        def vec(feats: list[str]) -> dict[str, float]:
            tf = Counter(feats)
            # Concepts carry more weight than unmapped words.
            v = {t: (1 + math.log(c)) * idf[t] * (1.5 if t.startswith("c:") else 1.0) for t, c in tf.items()}
            norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
            return {t: x / norm for t, x in v.items()}

        qv = vec(q_feats)
        out = []
        for cid, feats, concepts in docs:
            dv = vec(feats)
            cos = sum(w * dv.get(t, 0.0) for t, w in qv.items())
            out.append(Match(cid, round(cos, 4), lexicon.shared_concepts(q_concepts, concepts)))
        return out


class TransformerEngine:
    mode = "hybrid"  # multilingual embeddings + bilingual lexicon

    def __init__(self, model_name: str, threshold: float | None = None) -> None:
        from sentence_transformers import SentenceTransformer  # heavy import, deferred

        self.model = model_name
        self.threshold = threshold if threshold is not None else 0.62
        log.info("loading sentence-transformer %s …", model_name)
        self._model = SentenceTransformer(model_name)
        self._embed = lru_cache(maxsize=4096)(self._embed_uncached)
        self._lexicon = LexiconEngine()

    def _embed_uncached(self, text: str):
        return self._model.encode(text, normalize_embeddings=True)

    def score(self, query: str, candidates: list[tuple[str, str]]) -> list[Match]:
        qv = self._embed(query)
        # Hybrid: the embedding model is weak on romanized Hindi ("fees wapas nahi"),
        # so the bilingual lexicon score, rescaled onto this engine's threshold, is
        # used when it is stronger. See eval/reports for the measured effect.
        lex = {m.id: m for m in self._lexicon.score(query, candidates)}
        scale = self.threshold / self._lexicon.threshold
        out = []
        for cid, text in candidates:
            cos = max(0.0, float((qv * self._embed(text)).sum()))
            lm = lex[cid]
            out.append(Match(cid, round(max(cos, min(1.0, lm.score * scale)), 4), lm.shared_terms))
        return out


def build_engine():
    choice = os.getenv("AI_ENGINE", "auto").lower()
    threshold = os.getenv("SEMANTIC_THRESHOLD")
    t = float(threshold) if threshold else None
    model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    if choice in ("auto", "transformer"):
        try:
            return TransformerEngine(model_name, t)
        except ImportError:
            if choice == "transformer":
                raise
            log.warning("sentence-transformers not installed — using lexicon engine (pip install -r requirements-ml.txt)")
        except Exception as exc:  # model download / load failure
            if choice == "transformer":
                raise
            log.warning("could not load %s (%s) — using lexicon engine", model_name, exc)
    return LexiconEngine(t)
