"""CaseLink AI service — multilingual semantic similarity for overlap detection.

Stateless: the API sends one complaint and the same-institution candidates;
this service returns similarity scores plus the shared concepts that explain
each score. It never sees complainant identity — only complaint text.
"""

from __future__ import annotations

import hmac
import logging
import os
import threading
from contextlib import asynccontextmanager
from datetime import date

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import closure, promises
from .engine import build_engine

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

SERVICE_KEY = os.getenv("SERVICE_KEY", "")
PRODUCTION = os.getenv("ENV", "development") == "production"

_engine = None
_engine_lock = threading.Lock()


def get_engine():
    """Builds the similarity engine once, on first use. Lazy so the service also
    works as a serverless function, where startup hooks may not run."""
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = build_engine()
                logging.getLogger("caselink.ai").info("engine ready: %s (%s), threshold %.2f", _engine.mode, _engine.model, _engine.threshold)
    return _engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_engine()  # warm up when running as a long-lived server
    yield


app = FastAPI(
    title="CaseLink AI Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if PRODUCTION else "/docs",
    redoc_url=None,
)


def require_key(x_service_key: str | None = Header(default=None)) -> None:
    if SERVICE_KEY and not hmac.compare_digest(x_service_key or "", SERVICE_KEY):
        raise HTTPException(status_code=401, detail="Invalid service key")


class Item(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=8000)


class SimilarityRequest(BaseModel):
    query: Item
    candidates: list[Item] = Field(max_length=500)


class SimilarityResult(BaseModel):
    id: str
    score: float
    shared_terms: list[str]


class SimilarityResponse(BaseModel):
    mode: str
    model: str
    threshold: float
    results: list[SimilarityResult]


class EvidenceItem(BaseModel):
    type: str = Field(max_length=40)
    reference: str = Field(default="", max_length=300)


class ClosureRequest(BaseModel):
    complaint: str = Field(min_length=1, max_length=8000)
    response: str = Field(min_length=1, max_length=8000)
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=20)
    received_on: date | None = None  # date the reply arrived; promise deadlines count from it


@app.post("/closure-check", dependencies=[Depends(require_key)])
def closure_check(req: ClosureRequest) -> dict:
    result = closure.check(get_engine(), req.complaint, req.response, [e.model_dump() for e in req.evidence])
    result["promises"] = promises.extract_promises(req.response, req.received_on)
    return result


@app.get("/health")
def health() -> dict:
    engine = get_engine()
    return {"status": "ok", "mode": engine.mode, "model": engine.model, "threshold": engine.threshold}


@app.post("/similarity", response_model=SimilarityResponse, dependencies=[Depends(require_key)])
def similarity(req: SimilarityRequest) -> SimilarityResponse:
    engine = get_engine()
    matches = engine.score(req.query.text, [(c.id, c.text) for c in req.candidates])
    matches.sort(key=lambda m: m.score, reverse=True)
    return SimilarityResponse(
        mode=engine.mode,
        model=engine.model,
        threshold=engine.threshold,
        results=[SimilarityResult(id=m.id, score=m.score, shared_terms=m.shared_terms) for m in matches],
    )
