from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name(".env"))

from data_source import EngineStore
from nlp_engine import UserContext

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("nlp")

ESERVE_KEY = os.environ.get("ESERVE_KEY")
REFRESH_SECONDS = int(os.environ.get("NLP_REFRESH_SECONDS", "300"))

store: EngineStore | None = None

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global store
    store = EngineStore(ttl_seconds=REFRESH_SECONDS)
    store.get()
    yield

app = FastAPI(title="BME e-serve NLP Service", lifespan=lifespan)

def _guard(x_eserve_key: str | None) -> None:
    if ESERVE_KEY and x_eserve_key != ESERVE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

def _store() -> EngineStore:
    if store is None:
        raise HTTPException(status_code=503, detail="NLP engine is starting")
    return store

class Boiler(BaseModel):
    id: str
    code: str | None = None
    name: str | None = None

class AnalyzeRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    path: str | None = Field(default=None, max_length=500)
    role: str = "customer"
    allowed: list[str] = Field(default_factory=list)
    boilers: list[Boiler] = Field(default_factory=list, max_length=500)
    has_image: bool = False

@app.get("/health")
def health():
    s = _store()
    engine = s.get()
    return {
        "ok": True,
        "service": "nlp",
        "faqs": len(engine.faqs),
        "parts": len(engine.parts),
        "nltk": s.resources,
        "last_error": s.last_error,
    }

@app.post("/analyze")
def analyze(body: AnalyzeRequest, x_eserve_key: str | None = Header(default=None)):
    _guard(x_eserve_key)
    engine = _store().get()
    ctx = UserContext(
        role=body.role,
        allowed=set(body.allowed),
        boilers=[b.model_dump() for b in body.boilers],
        path=body.path or "",
    )
    return engine.analyze(body.message, ctx, has_image=body.has_image)

@app.post("/reload")
def reload(x_eserve_key: str | None = Header(default=None)):
    _guard(x_eserve_key)
    s = _store()
    s.refresh(background=False)
    engine = s.get()
    return {"ok": s.last_error is None, "faqs": len(engine.faqs), "parts": len(engine.parts), "error": s.last_error}