from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from processing import (
    ALLOWED_MEDIA,
    ImageTooLarge,
    UnsupportedImage,
    process_image,
)

load_dotenv(Path(__file__).with_name(".env"))

ESERVE_KEY = os.environ.get("ESERVE_KEY")

app = FastAPI(title="BME e-Serve Imaging Service")

class PreprocessRequest(BaseModel):
    data: str = Field(..., description="base64 image, with or without a data: URI prefix")
    media_type: str | None = Field(default=None)
    enhance: bool = Field(default=True)

class preprocessResponse(BaseModel):
    data: str
    media_type: str
    width: int
    height: int
    original_width: int
    original_height: int
    original_bytes: int
    processed_bytes: int
    rotated: bool
    metadata_stripped: bool

def _guard(x_eserve_key: str | None) -> None:
    if ESERVE_KEY and x_eserve_key != ESERVE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/health")
def health():
    return {"ok": True, "service": "imaging"}

@app.post("/preprocess", response_model=preprocessResponse)
def preprocess(
    body: PreprocessRequest,
    x_eserve_key: str | None = Header(default=None),
):
    _guard(x_eserve_key)

    if body.media_type and body.media_type not in ALLOWED_MEDIA:
        raise HTTPException(status_code=415, detail=f"Unsupported media type {body.media_type}")

    try:
        result = process_image(body.data, enhance=body.enhance)
    except ImageTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except UnsupportedImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return preprocessResponse(**result.__dict__)