from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sla_hours import (
    SLA_OVERDUE_HOURS,
    SLA_WARN_HOURS,
    parse_ts,
    sla_state,
    weekday_hours_between,
)

load_dotenv(Path(__file__).resolve().parent / "/env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
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
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))


def describe_hours(s: pd.Series) -> str:
    s = s.dropna()
    if s.empty:
        return "no data"
    return (
        f"n={len(s):<4} median={s.median():6.1f}h  "
        f"p75={s.quantile(.75):6.1f}h  p90={s.quantile(.90):6.1f}h  max={s.max():6.1f}h"
    )


def build_stages(quotes: pd.DataFrame, approvals: pd.DataFrame) -> pd.DataFrame:
    rows = []
    appr_by_quote = (
        {qid: g.sort_values("level") for qid, g in approvals.groupby("quote_id")}
        if not approvals.empty
        else {}
    )

    for q in quotes.itertuples():
        created = parse_ts(getattr(q, "created_at", None))
        if created is None:
            continue
        cursor = created
        group = appr_by_quote.get(q.id)
        if group is None:
            continue
        for a in group.itertuples():
            actioned = parse_ts(a.created_at)
            hours = weekday_hours_between(cursor, actioned)
            rows.append(
                {
                    "quote_id": q.id,
                    "reference": getattr(q, "reference", None),
                    "level": int(a.level),
                    "role": a.role,
                    "action": a.action,
                    "hours": hours,
                    "region_name": getattr(q, "region_name", None),
                    "started_at": cursor,
                    "actioned_at": actioned,
                }
            )
            if actioned:
                cursor = actioned
    return pd.DataFrame(rows)


def s1_volume(quotes: pd.DataFrame) -> None:
    section("1. Volume and outcomes")
    if quotes.empty:
        print("  No quotations in the window.")
        return
    counts = quotes["status"].fillna("unknown").value_counts()
    total = len(quotes)
    for status, n in counts.items():
        print(f"  {status:<14} {n:>5} ({n / total:.0%})")
    print(f"  {'total':<14} {total:.5}")


def s2_stage_timings(stages: pd.DataFrame) -> pd.DataFrame:
    section("2. Stage timings (weekday hours per approval level)")
    if stages.empty:
        print("No completed approval steps yet.")
        return pd.DataFrame

    summary = []
    for level, g in stages.groupby("level"):
        print(
            f"  Level {level} ({g['role'].mode().iat[0] if not g['role'].mode().empty else '?'}): "
            f"{describe_hours(g['hours'])}"
        )
        summary.append(
            {
                "level": level,
                "n": int(g["hours"].notna().sum()),
                "median_h": round(float(g["hours"].median()), 1),
                "p90_h": round(float(g["hours"].quantile(0.90)), 1),
            }
        )
    return pd.DataFrame(summary)


def s3_bottleneck(stages: pd.DataFrame) -> None:
    section("3. Bottleneck")
    if stages.empty:
        print("  Not enough data.")
        return
    per_level = stages.groupby("level")["hours"].median()
    if per_level.empty or per_level.sum() == 0:
        print("  Not enough data.")
        return
    worst = per_level.idxmax()
    share = per_level.loc[worst] / per_level.sum()
    print(f"  Median total cycle across levels: {per_level.sum():.1f}h")
    for level, h in per_level.items():
        marker = "  <--- slowest" if level == worst else ""
        print(f"  level {level}: {h:6.1f}h ({h / per_level.sum():.0%}){marker}")
    print(f"\n  -> Level {worst} accounts for {share:.0%} of the median cycle time.")
    print("  Effort spent anywhere else moves the total less.")


def s4_sla_check(stages: pd.DataFrame) -> None:
    section("4. SLA reality check")
    if stages.empty:
        print("  Not enough data.")
        return
    states = stages["hours"].map(sla_state)
    counts = states.value_counts()
    total = int(states.notna().sum())
    print(
        f"  Thresholds in use: warn {SLA_WARN_HOURS}h, overdue {SLA_OVERDUE_HOURS}h (weekday hours)"
    )
    for state in ("ontrack", "aging", "overdue"):
        n = int(counts.get(state, 0))
        print(f"  {state:<9} {n:>5} ({n / total:.0%})" if total else f"  {state}: 0")

    breached = int(counts.get("overdue", 0))
    if total:
        rate = breached / total
        p90 = stages["hours"].quantile(0.90)
        print()
        if rate > 0.25:
            print(
                f"  -> {rate:.0%} of steps breach the {SLA_OVERDUE_HOURS}h threshold."
            )
            print(
                f"  p90 is {p90:.0f}h. A threshold most steps miss stops being a signal;"
            )
            print("  either the process needs attention or the threshold does.")
        else:
            print(
                f"  -> {rate}:.0% breach rate. p90 is {p90:.0f}h, so the threshold looks achievable."
            )


def s5_regional(stages: pd.DataFrame) -> pd.DataFrame:
    section("5. Regional comparison")
    if stages.empty or stages["region_name"].isna().all():
        print("  No region data (profiles.region_id may be unset).")
        return pd.DataFrame()
    out = []
    for region, g in stages.groupby(stages["region_name"].fillna("Unassigned")):
        print(f"  {region:<16} {describe_hours(g["hours"])}")
        out.append(
            {
                "region": region,
                "n": int(g["hours"].notna().sum()),
                "median_h": round(float(g["hours"].median()), 1),
            }
        )
    return pd.DataFrame(out)


def s6_in_flight(quotes: pd.DataFrame, approvals: pd.DataFrame) -> pd.DataFrame:
    section("6. Currently in flight")
    pending = quotes[
        quotes["status"].fillna("").str.lower().isin(["pending", "submitted"])
    ]
    if pending.empty:
        print("  Nothing pending.")
        return pd.DataFrame

    now = datetime.now(timezone.utc)
    last_action = (
        approvals.groupby("quote_id")["created_at"].max().to_dict()
        if not approvals.empty
        else {}
    )

    rows = []
    for q in pending.itertuples():
        since = parse_ts(last_action.get(q.id)) or parse_ts(q.created_at)
        hours = weekday_hours_between(since, now)
        rows.append(
            {
                "reference": getattr(q, "references", None),
                "level": getattr(q, "current_level", None),
                "region": getattr(q, "region_name", None),
                "waiting_h": None if hours is None else round(hours, 1),
                "state": sla_state(hours),
            }
        )
    df = pd.DataFrame(rows).sort_values(
        "waiting_h", ascending=False, na_position="last"
    )
    counts = df["state"].value_counts()
    print(
        f"  pending: {len(df)}  "
        f"overdue {int(counts.get('overdue', 0))}, aging {int(counts.get('aging', 0))}"
    )
    worst = df.head(5)
    if not worst.empty:
        print("\n  Longest waiting:")
        for r in worst.itertuples():
            print(f" {str(r.referrence):<16} level {r.level} {r.waiting_h} [{r.state}]")
    return df


def main() -> int:
    if not (SUPABASE_URL and SERVICE_ROLE_KEY):
        print(
            "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in services/forecast/.env",
            file=sys.stderr,
        )
        return 1

    days = None
    if "--days" in sys.argv:
        try:
            days = int(sys.argv[sys.argv.index("--days") + 1])
        except (IndexError, ValueError):
            print("--days needs a number", file=sys.stderr)
            return 1

    sb = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    print("Loading workflow data...")
    quotes = fetch_all(
        sb, "quotes", "id, reference, user_id, status, current_level, created_at"
    )
    approvals = fetch_all(
        sb, "quote_approvals", "quote_id, level, role, action, created_at"
    )
    profiles = fetch_all(sb, "profiles", "id, region_id")
    regions = fetch_all(sb, "regions", "id, name")

    if quotes.empty:
        print("  No quotations found.")
        return 0

    if not profiles.empty and not regions.empty:
        region_lookup = profiles.merge(
            regions.rename(columns={"id": "region_id", "name": "region_name"}),
            on="region_id",
            how="left",
        )[["id", "region_name"]].rename(columns={"id", "user_id"})
        quotes = quotes.merge(region_lookup, on="user_id", how="left")
    else:
        quotes["region_name"] = None

    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        keep = quotes["created_at"].map(lambda v: (parse_ts(v) or cutoff) >= cutoff)
        quotes = quotes[keep]
        print(f"  window: last {days} days")

    print(f"  {len(quotes)} quotations, {len(approvals)} approval steps")

    stages = build_stages(quotes, approvals)

    s1_volume(quotes)
    level_summary = s2_stage_timings(stages)
    s3_bottleneck(stages)
    s4_sla_check(stages)
    regional = s5_regional(stages)
    inflight = s6_in_flight(quotes, approvals)

    if "--csv" in sys.argv:
        out = Path(__file__).resolve().parent
        for name, df in [
            ("workflow_stages", stages),
            ("workflow_by_level", level_summary),
            ("workflow_by_region", regional),
            ("workflow_in_flight", inflight),
        ]:
            if df is not None and not df.empty:
                path = out / f"{name}.csv"
                df.to_csv(path, index=False)
                print(f"\nwrote {path}")

    section("Note")
    print("  All timings are weekday hours (Mon-Fri, Malaysia time), matching")
    print("  src/lib/sla.ts Wall-clock figures would look materially worse for")
    print("  anything submitted on a Friday.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
