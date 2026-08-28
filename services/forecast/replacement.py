from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

MIN_INTERVAL_DAYS = 14
MAX_INTERVAL_DAYS = 1825

MIN_SAMPLES_TO_PREDICT = 2

@dataclass
class ReplacementRow:
    user_id: str
    customer_name: str | None
    company: str | None
    region_id: str | None
    region_name: str | None
    boiler_code: str
    boiler_id: str | None
    part_id: str
    part_number: str | None
    part_name: str | None
    last_ordered_on: str
    interval_days: int
    next_due_on: str
    interval_samples: int
    asset_orders: int
    confidence: str

def _parse_dt(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None

def _median(values: list[float]) -> float:
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2

def build_asset_events(quotes, items):
    q_meta = {}
    for q in quotes:
        if (q.get("status") or "").lower() != "approved":
            continue
        ordered_on = _parse_dt(q.get("created_at"))
        if ordered_on:
            q_meta[q["id"]] = (q.get("user_id"), ordered_on)

    events: dict = defaultdict(list)
    labels: dict = {}
    for it in items:
        part_id = it.get("part_id")
        boiler_code = (it.get("boiler_code") or "").strip()
        if not part_id or not boiler_code:
            continue
        meta = q_meta.get(it.get("quote_id"))
        if not meta:
            continue
        user_id, ordered_on = meta
        if not user_id:
            continue
        key = (user_id, boiler_code, part_id)
        events[key].append(ordered_on)
        labels[key] = (it.get("part_number"), it.get("part_name"))

    for key in events:
        events[key] = sorted(set(events[key]))
    return events, labels

def pool_intervals_by_part(events) -> dict:
    by_part: dict = defaultdict(list)
    for (_user, _boiler, part_id), dates in events.items():
        for earlier, later in zip(dates, dates[1:]):
            gap = (later - earlier).days
            if MIN_INTERVAL_DAYS <= gap <= MAX_INTERVAL_DAYS:
                by_part[part_id].append(gap)
    return by_part

def pool_service_intervals(rows) -> dict:
    by_part: dict = defaultdict(list)
    for r in rows:
        part_id = r.get("part_id")
        days = r.get("interval_days")
        if not part_id or days is None:
            continue
        try:
            gap = int(days)
        except (TypeError, ValueError):
            continue
        if MIN_INTERVAL_DAYS <= gap <= MAX_INTERVAL_DAYS:
            by_part[part_id].append(gap)
    return by_part


def _confidence(samples: int, asset_orders: int, source: str = "quote") -> str:
    # A measured interval is direct evidence, so it clears the bar with fewer
    # samples than an inferred purchase gap.
    if source == "service":
        if samples >= 4 and asset_orders >= 2:
            return "high"
        if samples >= 2:
            return "medium"
        return "low"
    if samples >= 6 and asset_orders >= 3:
        return "high"
    if samples >=3 and asset_orders >=2:
        return "medium"
    return "low"

def compute_replacements(
    quotes,
    items,
    profiles,
    regions,
    boilers,
    service_intervals=None,
    as_of: date | None = None,
):
    as_of = as_of or datetime.now(timezone.utc).date()

    events, labels = build_asset_events(quotes, items)
    quote_pooled = pool_intervals_by_part(events)
    service_pooled = pool_service_intervals(service_intervals or [])

    profile_by_id = {p["id"]: p for p in profiles}
    region_name = {r["id"]: r.get("name") for r in regions}
    boiler_by_code: dict = {}
    for b in boilers:
        code = (b.get("code") or "").strip()
        if code and code not in boiler_by_code:
            boiler_by_code[code] = b

    out: list[ReplacementRow] = []
    for key, dates in events.items():
        user_id, boiler_code, part_id = key
        samples = service_pooled.get(part_id, [])
        source = "service"
        if len(samples) < MIN_SAMPLES_TO_PREDICT:
            samples = quote_pooled.get(part_id, [])
            source = "quote"
        if len(samples) < MIN_SAMPLES_TO_PREDICT:
            continue

        interval_days = int(round(_median(samples)))
        last_ordered = dates[-1]
        next_due = last_ordered + timedelta(days=interval_days)

        profile = profile_by_id.get(user_id, {})
        region_id = profile.get("region_id")
        boiler = boiler_by_code.get(boiler_code, {})
        part_number, part_name = labels.get(key, (None, None))

        out.append(
            ReplacementRow(
                user_id=user_id,
                customer_name=profile.get("full_name"),
                company=profile.get("company"),
                region_id=region_id,
                region_name=region_name.get(region_id) if region_id else None,
                boiler_code=boiler_code,
                boiler_id=boiler.get("id"),
                part_id=part_id,
                part_number=part_number,
                part_name=part_name,
                last_ordered_on=last_ordered.isoformat(),
                interval_days=interval_days,
                next_due_on=next_due.isoformat(),
                interval_samples=len(samples),
                asset_orders=len(dates),
                confidence=_confidence(len(samples), len(dates), source),
            )
        )

    out.sort(key=lambda r: r.next_due_on)
    return out