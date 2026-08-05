from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from statistics import pstdev

def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)

def _next_month(d: date) -> date:
    return date(d.year + (d.month == 12), 1 if d.month == 12 else d.month + 1, 1)

@dataclass
class ForecastRow:
    region_id: str
    part_id: str
    region_name: str | None
    part_number: str | None
    part_name: str | None
    period_month: str
    predicted_qty: float
    lower_qty: float
    upper_qty: float
    method: str
    history_months: int
    history: list

def build_monthly_series(quotes, items, profiles, regions):
    region_of = {p["id"]: p.get("region_id") for p in profiles}
    region_name = {r["id"]: r.get("name") for r in regions}
    q_meta = {}
    for q in quotes:
        created = q.get("created_at")
        if not created:
            continue

        dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        q_meta[q["id"]] = (region_of.get(q.get("user_id")), _month_start(dt.date()))

    series: dict = defaultdict(lambda: defaultdict(float))
    labels: dict = {}
    for it in items:
        part_id = it.get("part_id")
        if not part_id:
            continue

        meta = q_meta.get(it.get("quote_id"))
        if not meta:
            continue
        region_id, month = meta
        if not region_id:
            continue
        qty = float(it.get("quantity") or 0)
        if qty <= 0:
            continue
        key = (region_id, part_id)
        series[key][month] += qty
        labels[key] = (
            region_name.get(region_id),
            it.get("part_number"),
            it.get("part_name"),
        )
    return series, labels

def _contiguous_history(by_month: dict, max_points: int = 12) -> list[dict]:
    if not by_month:
        return []
    months = sorted(by_month)
    cursor, last = months[0], months[-1]
    out: list[dict] = []
    while cursor <= last:
        out.append({"month": cursor.isoformat(), "qty": round(by_month.get(cursor, 0.0), 2)})
        cursor = _next_month(cursor)
    return out[-max_points:]

def _wma(values: list[float]) -> tuple[float, str]: # weighted moving average
    tail = values[-3:]
    if len(tail) >= 3:
        w = [1, 2, 3]
        return sum(v * wi for v, wi in zip(tail, w)) / sum(w), "wma3"
    if len(tail) == 2:
        return (tail[0] * 1 + tail[1] * 2) / 3, "wma2"
    return tail[0], "last1"

def compute_forecasts(quotes, items, profiles, regions, as_of: date | None = None):
    as_of = as_of or datetime.now(timezone.utc).date()
    target = _next_month(_month_start(as_of)).isoformat()

    series, labels = build_monthly_series(quotes, items, profiles, regions)
    out: list[ForecastRow] = []

    for key, by_month in series.items():
        region_id, part_id = key
        months = sorted(by_month)
        values = [by_month[m] for m in months]
        predicted, method = _wma(values)
        spread = pstdev(values) if len(values) > 1 else 0.0
        rname, pnum, pname = labels.get(key, (None, None, None))
        out.append(
            ForecastRow(
                region_id=region_id, 
                part_id=part_id, 
                region_name=rname, 
                part_number=pnum, 
                part_name=pname, 
                period_month=target, 
                predicted_qty=round(predicted, 2), 
                lower_qty=round(max(0.0, predicted - spread), 2), 
                upper_qty=round(predicted + spread, 2), 
                method=method, 
                history_months=len(months), 
                history=_contiguous_history(by_month)
            )
        )
    return out