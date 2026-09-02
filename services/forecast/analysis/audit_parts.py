from __future__ import annotations

import os
import sys
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

NEAR_DUPLICATE_THRESHOLD = 0.92
THIN_DESCRIPTION_CHARS = 25
PAGE = 1000

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
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=columns.split(", "))

def norm(s: object) -> None:
    return " ".join(str(s or "").lower().split())

def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))

def check_structural_duplication(parts: pd.DataFrame) -> pd.DataFrame:
    section("1. Structural duplication (same name, multiple boilers)")

    grouped = (
        parts.assign(name_key=parts["name"].map(norm))
        .groupby("name_key")
        .agg(
            copies=("id", "count"),
            boilers=("boiler_code", lambda s: ", ".join(sorted(map(str, s)))),
            example_name=("name", "first"),
            part_number=("part_number", lambda s: ", ".join(sorted(map(str, s))[:6])),
        )
        .reset_index()
    )
    dupes = grouped[grouped["copies"] > 1].sort_values("copies", ascending=False)

    total = len(parts)
    distinct = len(grouped)
    if total:
        print(f"{total} parts collapse to {distinct} distinct names" 
              f"({total - distinct} redundant rows, {(total - distinct) / total:.0%})")
        if dupes.empty:
            print("No duplicated names.")
        else:
            print(f"\n{len(dupes)} name(s) appear more than once. Worst offenders:\n")
            for _, r in dupes.head(10).iterrows():
                print(f"    {r['copied']}x {r['example_name'][:52]:<52} [{r['boilers']}]")
                print("\n   -> Retrieval fix: deduplicate on name before formatting candidates,")
                print("     or filter to the customer's own boiler.")
        return dupes