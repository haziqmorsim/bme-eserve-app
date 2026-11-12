from __future__ import annotations

import logging
import os
import threading
import time

from nlp_engine import Engine, ensure_nltk_data

log = logging.getLogger("nlp")

PAGE_SIZE = 1000

def _client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client

    return create_client(url, key)

def _fetch_all(sb, table: str, columns: str, apply=None) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        query = sb.table(table).select(columns).range(start, start + PAGE_SIZE - 1)
        if apply:
            query = apply(query)
        batch = query.execute().data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE

def load_data() -> tuple[list[dict], list[dict]]:
    sb = _client()
    if sb is None:
        log.warning("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; FAQs and parts will be empty.")
        return [], []

    faqs = _fetch_all(
        sb,
        "faqs",
        "id, question, answer, sort_order",
        lambda q: q.eq("is_published", True).order("sort_order"),
    )
    components = {c["id"]: c for c in _fetch_all(sb, "components", "id, name, boiler_id")}
    parts = []
    for p in _fetch_all(sb, "parts", "id, part_number, name, description, component_id"):
        comp = components.get(p.get("component_id")) or {}
        parts.append(
            {
                "id": p["id"],
                "part_number": p.get("part_number"),
                "name": p.get("name"),
                "description": p.get("description"),
                "component_name": comp.get("name"),
                "boiler_id": comp.get("boiler_id"),
            }
        )
    return faqs, parts

class EngineStore:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self.resources = ensure_nltk_data(download=True)
        self._engine: Engine | None = None
        self._built_at = 0.0
        self._lock = threading.Lock()
        self._refreshing = False
        self.last_error: str | None = None

    def _build(self) -> Engine:
        faqs, parts = load_data()
        engine = Engine(faqs, parts, self.resources)
        log.info("NLP engine built: %d FAQs, %d unique parts", len(engine.faqs), len(engine.parts))
        return engine

    def get(self) -> Engine:
        if self._engine is None:
            with self._lock:
                if self._engine is None:
                    self._engine = self._build()
                    self._built_at = time.time()
        elif time.time() - self._built_at > self.ttl:
            self.refresh(background=True)
        return self._engine

    def refresh(self, background: bool = False) -> None:
        def run():
            try:
                engine = self._build()
                self._engine, self._built_at, self.last_error = engine, time.time(), None
            except Exception as exc:
                self.last_error = str(exc)
                self._built_at = time.time()
                log.exception("NLP engine refresh failed")
            finally:
                self._refreshing = False

        with self._lock:
            if self._refreshing:
                return
            self._refreshing = True
        if background:
            threading.Thread(target=run, daemon=True).start()
        else:
            run()