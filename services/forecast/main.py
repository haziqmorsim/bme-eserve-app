from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from supabase import Client, create_client

from forecast import compute_forecasts
from replacement import compute_replacements

load_dotenv(Path(__file__).with_name(".env"))


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            f"Locally: add it to services/forecast/.env. "
            f"In production: set it in the host dashboard."
        )
    return value


SUPABASE_URL = _required("SUPABASE_URL")
SERVICE_ROLE_KEY = _required("SUPABASE_SERVICE_ROLE_KEY")
ESERVE_KEY = os.environ.get("ESERVE_KEY")

app = FastAPI(title="BME e-Serve Forecast Service")


def _client() -> Client:
    return create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

def _guard(x_eserve_key: str | None) -> None:
    if ESERVE_KEY and x_eserve_key != ESERVE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/replacements/run")
def run_replacements(x_eserve_key: str | None = Header(default=None)):
    _guard(x_eserve_key)
    sb = _client()

    quotes = (
        sb.table("quotes").select("id, user_id, created_at, status").execute().data or []
    )
    items = (
        sb.table("quote_items")
        .select("quote_id, part_id, boiler_code, part_number, part_name")
        .execute()
        .data
        or []
    )
    profiles = (
        sb.table("profiles").select("id, full_name, company, region_id").execute().data or []
    )
    regions = sb.table("regions").select("id, name").execute().data or []
    boilers = sb.table("boilers").select("id, code").execute().data or []
    service_intervals = (
        sb.table("service_intervals").select("part_id, interval_days").execute().data or []
    )

    rows = compute_replacements(
        quotes, items, profiles, regions, boilers, service_intervals=service_intervals
    )
    payload = [r.__dict__ for r in rows]

    if payload:
        sb.table("part_replacement_schedule").upsert(
            payload, on_conflict="user_id,boiler_code,part_id"
        ).execute()

    return {"ok": True, "replacements_written": len(payload)}

@app.post("/forecasts/run")
def run(x_eserve_key: str | None = Header(default=None)):
    _guard(x_eserve_key)
    sb = _client()

    quotes = sb.table("quotes").select("id, user_id, created_at").execute().data or []
    items = (
        sb.table("quote_items")
        .select("quote_id, part_id, part_number, part_name, quantity")
        .execute()
        .data
        or []
    )
    profiles = sb.table("profiles").select("id, region_id").execute().data or []
    regions = sb.table("regions").select("id, name").execute().data or []

    rows = compute_forecasts(quotes, items, profiles, regions)
    payload = [r.__dict__ for r in rows]

    if payload:
        sb.table("part_demand_forecasts").upsert(
            payload, on_conflict="region_id,part_id,period_month"
        ).execute()

    return {"ok": True, "forecasts_written": len(payload)}