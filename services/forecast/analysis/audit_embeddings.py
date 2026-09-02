from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

DEFAULT_THRESHOLD = 0.88
PAGE = 1000
MAX_PARTS_DENSE = 5000


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


def parse_embedding(value) -> np.ndarray | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        arr = np.asarray(value, dtype=np.float32)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            arr = np.asarray(json.loads(text), dtype=np.float32)
        except (json.JSONDecodeError, ValueError):
            try:
                arr = np.fromstring(text.strip("[]"), sep=",", dtype=np.float32)
            except ValueError:
                return None
    else:
        return None
    if arr.ndim != 1 or arr.size == 0 or not np.isfinite(arr).all():
        return None
    return arr


def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))


def norm_name(s: object) -> str:
    return " ".join(str(s or "").lower().split())


class UnionFind:

    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    unit = vectors / norms
    sim = unit @ unit.T
    return np.clip(sim, -1.0, 1.0)


def s1_coverage(parts: pd.DataFrame, usable: int) -> None:
    section("1. Embedding coverage")
    total = len(parts)
    print(f"  parts in catalogue: {total}")
    print(f"  with embeddings: {usable}")
    missing = total - usable
    if missing:
        print(f"  missing: {missing}")
        print("\n -> Unembedded parts are invisible here and to match_parts().")
        print("  Run: python embed_parts.py")


def s2_distribution(sim: np.ndarray, threshold: float) -> None:
    section("2. Nearest-neighbour similarity distribution")
    if sim.shape[0] < 2:
        print("  Need at least 2 embedded parts.")
        return
    masked = sim.copy()
    np.fill_diagonal(masked, -np.inf)
    nearest = masked.max(axis=1)

    for q in (50, 75, 90, 95, 99):
        print(f"  p{q:<3} {np.percentile(nearest, q):.3f}")
    print(f"  max  {nearest.max():.3f}")

    above = int((nearest >= threshold).sum())
    print(
        f"\n  {above} of {len(nearest)} parts have a neighbour at or above "
        f"{threshold:.2f} ({above / len(nearest):.0%})"
    )
    print("  -> If p50 is alredy high, the catalogue is broadly self-similar and")
    print("  a higher threshold will be needed to isolate real duplicates.")


def s3_clusters(
    sim: np.ndarray, meta: pd.DataFrame, threshold: float
) -> tuple[pd.DataFrame, list[list[int]]]:
    section(f"3. Semantic clusters (cosine >= {threshold:.2f})")
    n = sim.shape[0]
    if n < 2:
        print("  Need at least 2 embedded parts.")
        return pd.DataFrame, []

    uf = UnionFind(n)
    iu = np.triu_indices(n, k=1)
    pairs = np.argwhere(sim[iu] >= threshold).ravel()
    for idx in pairs:
        uf.union(int(iu[0][idx]), int(iu[1][idx]))

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(uf.find(i), []).append(i)
    clusters = [g for g in groups.values() if len(g) > 1]
    clusters.sort(key=len, reverse=True)

    if not clusters:
        print("  No clusters at this threshold.")
        return pd.DataFrame(), []

    grouped_parts = sum(len(c) for c in clusters)
    print(
        f"  {len(clusters)} cluster(s) covering {grouped_parts} parts "
        f"({grouped_parts / n:.0%} of the embedded catalogue)\n"
    )

    rows = []
    for ci, members in enumerate(clusters, start=1):
        names = {norm_name(meta.iloc[i]["name"]) for i in members}
        kind = "same name" if len(names) == 1 else "DIFFERENT NAMES"

        if ci <= 10:
            print(f"  Cluster {ci} ({len(members)} parts, {kind}):")
            for i in members[:6]:
                r = meta.iloc[i]
                print(f"  {str(r['part_number']):<20} {str(r['name'])[:46]}")
            if len(members) > 6:
                print(f"  ... and {len(members) - 6} more")
            print()
        for i in members:
            r = meta.iloc[i]
            rows.append(
                {
                    "cluster": ci,
                    "cluster_size": len(members),
                    "distinct_names": len(names),
                    "part_number": r["part_number"],
                    "name": r["name"],
                    "boiler_code": r.get("boiler_code"),
                }
            )
    if len(clusters) > 10:
        print(
            f"  ... and {len(clusters) - 10} more cluster(s); use --csv for the full list."
        )
    return pd.DataFrame(rows), clusters


def s4_verdict(meta: pd.DataFrame, clusters: list[list[int]]) -> None:
    section("4. Verdict: is name-based deduplication sufficient?")
    if not clusters:
        print("  No clusters found, so no deduplication is needed at this threshold.")
        return

    same_name = [
        c for c in clusters if len({norm_name(meta.iloc[i]["name"]) for i in c}) == 1
    ]
    mixed = [
        c for c in clusters if len({norm_name(meta.iloc[i]["name"]) for i in c}) > 1
    ]

    print(f"  clusters where every member shares one name: {len(same_name)}")
    print(f"  clusters spanning DIFFERENT names: {len(mixed)}")

    if not mixed:
        print("\n  -> Every semantic duplicate also shares a name. Deduplicating")
        print("  candidates on `name` in formatCandidates() is sufficient.")
        return

    print("\n  -> Name-based deduplication is NOT sufficient. These clusters are")
    print("  the same component under different names, so they would survive")
    print("  a name-based filter and still crowd the shortlist:\n")
    for c in mixed[:5]:
        variants = sorted({str(meta.iloc[i]["name"]) for i in c})
        print(f"  - {' | '.join(v[:40] for v in variants[:3])}")
    print("\n  Options: merge them in the catalogue, or deduplicate retrieval")
    print("  results by similarity (keep the top hit per cluster).")


def main() -> int:
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print(
            "Missing SUPABASE_URL / SUPABASE_SERVICE ROLE KEY in services/forecast/.env",
            file=sys.stderr,
        )
        return 1

    threshold = DEFAULT_THRESHOLD
    if "--threshold" in sys.argv:
        try:
            threshold = float(sys.argv[sys.argv.index("--threshold") + 1])
        except (IndexError, ValueError):
            print("--threshold needs a number between 0 and 1", file=sys.stderr)
            return 1
    if not 0.0 < threshold <= 1.0:
        print("--threshold must be between 0 and 1", file=sys.stderr)
        return 1

    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    print("Loading embeddings...")
    parts = fetch_all(sb, "parts", "id, component_id, part_number, name, embedding")
    if parts.empty:
        print("No parts found.")
        return 0

    components = fetch_all(sb, "components", "id, boiler_id")
    boilers = fetch_all(sb, "boilers", "id, code")
    if not components.empty and not boilers.empty:
        parts = parts.merge(
            components.rename(columns={"id": "component_id"}),
            on="component_id",
            how="left",
        ).merge(
            boilers.rename(columns={"id": "boiler_id", "code": "boiler_code"}),
            on="boiler_id",
            how="left",
        )
    else:
        parts["boiler_code"] = None

    vectors, keep = [], []
    for idx, raw in enumerate(parts["embedding"]):
        vec = parse_embedding(raw)
        if vec is not None:
            vectors.append(vec)
            keep.append(idx)

    s1_coverage(parts, len(vectors))
    if len(vectors) < 2:
        print("\nNot enough embedded parts to compare.")
        return 0

    dims = {v.size for v in vectors}
    if len(dims) > 1:
        print(
            f"\nInconsistent embedding dimensions {sorted(dims)} -- re-run embedded_parts.py --all",
            file=sys.stderr,
        )
        return 1
    if len(vectors) > MAX_PARTS_DENSE:
        print(
            f"\n{len(vectors)} parts exceeds the dense-matrix limit "
            f"({MAX_PARTS_DENSE}); use pgvector directly instead.",
            file=sys.stderr,
        )
        return 1

    meta = parts.iloc[keep].reset_index(drop=True)
    sim = cosine_matrix(np.vstack(vectors))

    s2_distribution(sim, threshold)
    cluster_df, clusters = s3_clusters(sim, meta, threshold)
    s4_verdict(meta, clusters)

    if "--csv" in sys.argv and not cluster_df.empty:
        path = Path(__file__).resolve().parent / "semantic_clusters.csv"
        cluster_df.to_csv(path, index=False)
        print(f"\nwrote {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
