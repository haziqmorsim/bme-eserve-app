from __future__ import annotations

import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-3"
BATCH = 32
PAUSE_SECONDS = 2.0
MAX_RETRIES = 6

DEFAULT_THRESHOLD = 0.78
MIN_CLUSTER_SIZE = 2
PAGE = 1000

STOPWORDS = {
    "the", "and", "for", "you", "our", "your", "with", "this", "that", "have", "has", "are", "was", "were", "can", "could", "would", "will", "from", "please", "hello", "hi", "dear", "thanks", "thank", "regards", "kindly", "would", "like", "need", "want", "any", "all", "not", "but", "get", "there", "their", "boiler", "part", "parts", "we", "us", "it", "is", "to", "of", "in", "on", "a", "i", "my", "me", "at", "as", "be",
}

def fetch_all(sb, table: str, columns: str) -> pd.DataFrame:
    frames, start = [], 0
    while True:
        res = sb.table(table).select(columns).range(start, start + PAGE - 1).execute()
        rows = res.data or []
        if not rows:
            break
        frames.append(pd.DataFrame(rows))
        if len(rows) < PAGE:
            break
        start += PAGE
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

def embed_batch(texts: list[str]) -> list[list[float]]:
    delay = 2.0
    for attempt in range(1, MAX_RETRIES + 1):
        resp = httpx.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
            json={"input": texts, "model": MODEL, "input_type": "document"},
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
            if attempt == MAX_RETRIES:
                resp.raise_for_status()
            print(f"  rate limited; waiting {wait:.0f}s")
            time.sleep(wait)
            delay = min(delay * 2, 60.0)
            continue
        resp.raise_for_status()
        data = resp.json()["data"]
        return [d["embedding"] for d in sorted(data, key=lambda d:d["index"])]
    raise RuntimeError("exhausted retries")

def embed_all(texts: list[str]) -> np.ndarray:
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        out.extend(embed_batch(texts[i : i + BATCH]))
        if i + BATCH < len(texts):
            time.sleep(PAUSE_SECONDS)
        print(f"  embedded {min(i + BATCH, len(texts))}/{len(texts)}")
    return np.asarray(out, dtype=np.float32)

def cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    unit = vectors / norms
    return np.clip(unit @ unit.T, -1.0, 1.0)

def star_clusters(sim: np.ndarray, threshold: float) -> list[list[int]]:
    n = sim.shape[0]
    adjacency = sim >= threshold
    np.fill_diagonal(adjacency, False)

    unassigned = set(range(n))
    clusters: list[list[int]] = []

    while unassigned:
        idx = list(unassigned)
        degrees = [(int(adjacency[i, idx].sum()), i) for i in idx]
        degree, seed = max(degrees)
        if degree == 0:
            break
        members = [seed] + [i for i in idx if i != seed and adjacency[seed, i]]
        clusters.append(sorted(members))
        unassigned -= set(members)

    return [c for c in clusters if len(c) >= MIN_CLUSTER_SIZE]

def top_terms(messages: list[str], k: int = 6) -> list[str]:
    words = []
    for m in messages:
        for w in re.findall(r"[a-z]{3,}", str(m).lower()):
            if w not in STOPWORDS:
                words.append(w)
    return [w for w, _ in Counter(words).most_common(k)]

def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))

def s2_spread(sim: np.ndarray, threshold: float) -> None:
    section("2. Similarity spread")
    if sim.shape[0] < 2:
        print("  Need at least two enquiries.")
        return
    masked = sim.copy()
    np.fill_diagonal(masked, -np.inf)
    nearest = masked.max(axis=1)
    for q in (25, 50, 75, 90):
        print(f"  p{q:<3} {np.percentile(nearest, q):.3f}")
    above = int((nearest >= threshold).sum())
    print(f"\n  {above}/{len(nearest)} enquiries have a neighbour at or above {threshold:.2f}")
    if np.percentile(nearest, 50) >= threshold:
        print("  -> Over half the corpus is above the threshold; raise it or the")
        print("  clusters will be too broad to act on.")

def s3_clusters(clusters, meta: pd.DataFrame, parts_by_id: dict) -> pd.DataFrame:
    section("3. Clusters")
    if not clusters:
        print("  No clusters at this threshold. Try a lower --threshold.")
        return pd.DataFrame()

    rows = []
    for ci, members in enumerate(sorted(clusters, key=len, reverse=True), start=1):
        sub = meta.iloc[members]
        msgs = sub["message"].fillna("").toList()
        terms = top_terms(msgs)

        tagged = sub[sub["resolved_part_id"].notna()]
        tag_counts = Counter(
            parts_by_id.get(pid, pid) for pid in tagged["resolved_part_id"]
        )

        if ci <= 8:
            print(f"  Cluster {ci}: {len(members)} enquiries [{', '.join(terms)}]")
            for m in msgs[:3]:
                snippet = " ".join(str(m).split())[:88]
                print(f"  - {snippet}")
            if len(msgs) > 3:
                print(f" ... and {len(msgs) - 3} more")
            if tag_counts:
                top, n = tag_counts.most_common(1)[0]
                print(f"  -> {n} already tagged as {top}; "
                      f"{len(members) - len(tagged)} untagged could follow")
            else:
                print(f"   -> None tagged yet")
            print()

        for i in members:
            r = meta.iloc[i]
            rows.append({
                "cluster": ci,
                "cluster_size": len(members),
                "terms": " ".join(terms),
                "enquiry_id": r["id"],
                "company": r.get("company"),
                "message": r["message"],
                "resolution": r.get("resolution"),
                "resolved_part": parts_by_id.get(r.get("resolved_part_id")),
                "suggested_tag": tag_counts.most_common(1)[0][0] if tag_counts else None,
            })

    if len(clusters) > 8:
        print(f"  ... and {len(clusters) - 8} more cluster(s); use --csv for the full list.")
    return pd.DataFrame(rows)

def s4_value(clusters, meta: pd.DataFrame) -> None:
    section("4. Bulk-tagging value")
    if not clusters:
        print("  Nothing to bulk tag.")
        return
    clustered = sum(len(c) for c in clusters)
    untagged_in_clusters = sum(int(meta.iloc[c]["resolved_part_id"].isna().sum()) for c in clusters)
    total = len(meta)
    isolated = total - clustered

    print(f"  enquiries embedded: {total}")
    print(f"  fell into a cluster: {clustered}")
    print(f"  isolated (tag individually): {isolated}")
    print(f"  untagged, inside a cluster: {untagged_in_clusters}")
    if clusters:
        print(f"\n  -> {untagged_in_clusters} enquiries could be reviewed as "
              f"{len(clusters)} cluster decisions instead of {untagged_in_clusters} individual ones.")
        print("  Confirm the cluster genuinely shares one part before bulk tagging;")
        print("  a wrong bulk label is far more damaging than a missing one.")

def main() -> int:
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1
    if not VOYAGE_API_KEY:
        print("Missing VOYAGE_API_KEY", file=sys.stderr)
        return 1

    threshold = DEFAULT_THRESHOLD
    if "--threshold" in sys.argv:
        try:
            threshold = float(sys.argv[sys.argv.index("--threshold") + 1])
        except (IndexError, ValueError):
            print("--threshold needs a number between 0 and 1", file=sys.stderr)
            return 1

    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    print("Loading enquiries...")
    enq = fetch_all(sb, "enquiries", "id, company, message, created_at, resolution, resolved_part_id")
    if enq.empty:
        print("No enquiries found.")
        return 0

    parts = fetch_all(sb, "parts", "id, part_number")
    parts_by_id = dict(zip(parts["id"], parts["part_number"])) if not parts.empty else {}

    if "resolved_part_id" not in enq.columns:
        enq["resolved_part_id"] = None
        enq["resolution"] = None

    if "--all" not in sys.argv:
        before = len(enq)
        enq = enq[enq["resolution"].isna()]
        print(f"  {len(enq)} untagged of {before} (use --all to include tagged)")

    enq = enq[enq["message"].fillna("").str.strip().str.len() > 10].reset_index(drop=True)

    section("1. Coverage")
    print(f"  enquiries to embed: {len(enq)}")
    if len(enq) < 2:
        print("  Not enough to cluster.")
        return 0

    vectors = embed_all(enq["message"].fillna("").tolist())
    sim = cosine_matrix(vectors)

    s2_spread(sim, threshold)
    clusters = star_clusters(sim, threshold)
    df = s3_clusters(clusters, enq, parts_by_id)
    s4_value(clusters, enq)

    if "--csv" in sys.argv and not df.empty:
        path = Path(__file__).resolve().parent / "enquiry_clusters.csv"
        df.to_csv(path, index=False)
        print(f"\nwrote {path}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())