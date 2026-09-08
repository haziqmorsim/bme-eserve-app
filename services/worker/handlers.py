from __future__ import annotations

import os
import time

import httpx

VOYAGE_URL="https://api.voyageai.com/v1/embeddings"
EMBED_MODEL="voyage-3"
BATCH = 32
PAUSE_SECONDS = 2.0
MAX_RETIRES = 6

def _voyage_key() -> str:
    key = os.environ.get("VOYAGE_API_KEY")
    if not key:
        raise RuntimeError("VOYAGE_API_KEY is not set.")
    return key

def _embed_batch(texts: list[str]) -> list[list[float]]:
    delay = 2.0
    for attempt in range(1, MAX_RETIRES + 1):
        resp = httpx.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {_voyage_key()}"},
            json={"input": texts, "model": EMBED_MODEL, "input_type": "document"},
            timeout=60.0
        )
        if resp.status_code == 429:
            wait = delay
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    wait = max(wait, float(retry_after))
                except ValueError:
                    pass
            if attempt == MAX_RETIRES:
                resp.raise_for_status()
            time.sleep(wait)
            delay = min(delay * 2, 60.0)
            continue
        resp.raise_for_status()
        data = resp.json()["data"]
        return [d["embedding"] for d in sorted(data, key=lambda d: d["index"])]
    raise RuntimeError("exhausted embedding retries")

def build_embedding_text(part: dict) -> str:
    bits = [
        part.get("part_number") or "",
        part.get("name") or "",
        part.get("description") or "",
    ]
    return " | ".join(b.strip() for b in bits if b and b.strip())

def embed_parts(sb, payload: dict) -> dict:
    redo_all = bool(payload.get("all"))
    part_ids = payload.get("part_ids") or []

    query = sb.table("parts").select("id, part_number, name, description")
    if part_ids:
        query = query.in_("id", part_ids)
    elif not redo_all:
        query = query.is_("embedding", "null")

    parts = query.execute().data or []
    if not parts:
        return {"embedded": 0, "skipped": 0, "note": "nothing to embed"}

    embedded = 0
    skipped = 0
    for i in range(0, len(parts), BATCH):
        chunk = parts[i : i + BATCH]
        usable = [(p, build_embedding_text(p)) for p in chunk]
        usable = [(p, t) for p, t in usable if t]
        skipped += len(chunk) - len(usable)
        if not usable:
            continue

        vectors = _embed_batch([t for _, t in usable])
        for (part, text), vec in zip(usable, vectors):
            sb.table("parts").update(
                {"embedding": vec, "embedding_text": text, "embedding_at": "now()"}
            ).eq("id", part["id"]).execute()
            embedded += 1

        if i + BATCH < len(parts):
            time.sleep(PAUSE_SECONDS)

    return {"embedded": embedded, "skipped": skipped, "candidates": len(parts)}

def bulk_tag_enquiries(sb, payload: dict) -> dict:
    enquiry_ids = payload.get("enquiry_ids") or []
    part_id = payload.get("part_id")
    resolution = payload.get("resolution") or "part_identified"
    resolved_by = payload.get("resolved_by")

    if not enquiry_ids:
        raise ValueError("bulk_tag_enquiries requires enquiry_ids")
    if resolution == "part_identified" and not part_id:
        raise ValueError("part_identified requires part_id")
    if resolution not in ("part_identified", "no_part_needed", "not_applicaple"):
        raise ValueError(f"Unknown resolution {resolution!r}")

    if part_id:
        exists = sb.table("parts").select("id").eq("id", part_id).limit(1).execute().data
        if not exists:
            raise ValueError(f"part_id {part_id} does not exist")

    eligible = (
        sb.table("enquiries")
        .select("id")
        .in_("id", enquiry_ids)
        .is_("resolution", "null")
        .execute()
        .data
        or []
    )
    eligible_ids = [r["id"] for r in eligible]
    skipped = len(enquiry_ids) - len(eligible_ids)

    if not eligible_ids:
        return {"tagged": 0, "skipped": skipped, "note": "all already resolved"}

    sb.table("enquiries").update(
        {
            "resolution": resolution,
            "resolved_part_id": part_id if resolution == "part_identified" else None,
            "resolved_by": resolved_by,
            "resolved_at": "now()",
        }
    ).in_("id", eligible_ids).execute()

    return {"tagged": len(eligible_ids), "skipped": skipped}

HANDLERS = {
    "embed_parts": embed_parts,
    "bulk_tag_enquiries": bulk_tag_enquiries,
}