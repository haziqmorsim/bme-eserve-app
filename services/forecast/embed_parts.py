from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-3"

BATCH = 32
PAUSE_SECONDS = 2.0
MAX_RETRIES = 6


def build_text(part: dict) -> str:
    bits = [
        part.get("part_number") or "",
        part.get("name") or "",
        part.get("description") or "",
    ]
    return " | ".join(b.strip() for b in bits if b and b.strip())


def embed_batch(texts: list[str]) -> list[list[float]]:
    delay = 2.0
    for attempt in range(1, MAX_RETRIES + 1):
        resp = httpx.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
            json={"input": texts, "model": MODEL, "input_type": "document"},
            timeout=60.0,
        )

        if resp.status_code == 429:
            wait = delay
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                try:
                    wait = max(wait, float(retry_after))
                except ValueError:
                    pass
            if attempt == MAX_RETRIES:
                resp.raise_for_status()
            print(f"    rate limited; waiting {wait:.0f}s (attempt {attempt}/{MAX_RETRIES})")
            time.sleep(wait)
            delay = min(delay * 2, 60.0)
            continue

        resp.raise_for_status()
        data = resp.json()["data"]
        return [d["embedding"] for d in sorted(data, key=lambda d: d["index"])]

    raise RuntimeError("exhausted retries")


def main() -> int:
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1
    if not VOYAGE_API_KEY:
        print("Missing VOYAGE_API_KEY -- get one at https://voyageai.com", file=sys.stderr)
        return 1

    redo_all = "--all" in sys.argv
    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    query = sb.table("parts").select("id, part_number, name, description")
    if not redo_all:
        query = query.is_("embedding", "null")
    parts = query.execute().data or []

    if not parts:
        print("Nothing to embed. Use --all to re-embed the whole catalogue.")
        return 0

    print(f"Embedding {len(parts)} part(s) with {MODEL}...")
    done = 0
    for i in range(0, len(parts), BATCH):
        chunk = parts[i : i + BATCH]
        texts = [build_text(p) for p in chunk]

        usable = [(p, t) for p, t in zip(chunk, texts) if t]
        if not usable:
            continue

        try:
            vectors = embed_batch([t for _, t in usable])
        except httpx.HTTPStatusError as e:
            print(f"\nStopped after {done}/{len(parts)}: {e}", file=sys.stderr)
            print("Progress is saved. Re-run the script to continue.", file=sys.stderr)
            return 1

        for (part, text), vec in zip(usable, vectors):
            sb.table("parts").update(
                {
                    "embedding": vec,
                    "embedding_text": text,
                    "embedded_at": "now()",
                }
            ).eq("id", part["id"]).execute()
            done += 1

        print(f"  {done}/{len(parts)}")

        if i + BATCH < len(parts):
            time.sleep(PAUSE_SECONDS)

    print(f"Done. {done} part(s) embedded.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())