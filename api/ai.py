"""Vercel serverless entry for the CaseLink AI service.

Vercel routes /ai/* here (see vercel.json). The service itself lives in
ai-service/app; it is mounted under /ai so the API can call
https://<your-app>/ai/similarity and /ai/closure-check.

Serverless uses the lightweight bilingual lexicon engine (pure Python). The
multilingual transformer engine needs a long-running server with ~1.5 GB RAM.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("AI_ENGINE", "lexicon")
os.environ.setdefault("ENV", "production")
# One shared secret for the project: the API sends AI_SERVICE_KEY.
os.environ.setdefault("SERVICE_KEY", os.environ.get("AI_SERVICE_KEY", ""))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ai-service"))

from fastapi import FastAPI  # noqa: E402

from app.main import app as service  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/ai", service)
app.mount("/api/ai", service)  # direct hits on the function path
