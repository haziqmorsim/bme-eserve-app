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
    project_id: str
    part_id: str
    project_no: str | None
    project_name: str | None
    boiler_code: str | None
    part_number: str | None
    part_name: str | None
    period_month: str
    predicted_qty: float
    lower_qty: float
    upper_qty: float
    method: str
    history_months: int
    history: list

def build_project_resolver(customer_projects, projects, boiler_projects, part_boiler):
    order = {p["id"]: (p.get("sort_order") or 0, p.get("project_no") or "") for p in projects}

    by_user: dict = defaultdict(list)
    for row in customer_projects:
        uid, pid = row.get("user_id"), row.get("project_id")
        if uid and pid:
            by_user[uid].append(pid)

    by_boiler: dict = defaultdict(set)
    for row in boiler_projects:
        bid, pid = row.get("boiler_id"), row.get("project_id")
        if bid and pid:
            by_boiler[bid].add(pid)

    def pick(candidates: list[str]) -> str | None:
        if not candidates:
            return None
        return sorted(candidates, key=lambda pid: order.get(pid, (9999, "")))[0]

    def resolve(user_id: str | None, part_id: str | None) -> str | None:
        if not user_id:
            return None
        held = by_user.get(user_id) or []
        if not held:
            return None
        boiler_id = part_boiler.get(part_id)
        if boiler_id:
            overlap = [pid for pid in held if pid in by_boiler.get(boiler_id, ())]
            if overlap:
                return pick(overlap)
        return pick(held)

    return resolve

def build_monthly_series(quotes, items, resolve, part_meta):
    q_meta = {}
    for q in quotes:
        created = q.get("created_at")
        if not created:
            continue
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        q_meta[q["id"]] = (q.get("user_id"), _month_start(dt.date()))

    series: dict = defaultdict(lambda: defaultdict(float))
    labels: dict = {}

    for it in items:
        part_id = it.get("part_id")
        if not part_id:
            continue
        meta = q_meta.get(it.get("quote_id"))
        if not meta:
            continue
        user_id, month = meta
        qty = float(it.get("quantity") or 0)
        if qty <= 0:
            continue

        project_id = resolve(user_id, part_id)
        if not project_id:
            continue

        key = (project_id, part_id)
        series[key][month] += qty

        info = part_meta.get(part_id, {})
        labels[key] = (
            info.get("boiler_code"),
            info.get("part_number") or it.get("part_number"),
            info.get("name") or it.get("part_name"),
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

def _wma(values: list[float]) -> tuple[float, str]:
    tail = values[-3:]
    if len(tail) >= 3:
        w = [1, 2, 3]
        return sum(v * wi for v, wi in zip(tail, w)) / sum(w), "wma3"
    if len(tail) == 2:
        return (tail[0] * 1 + tail[1] * 2) / 3, "wma2"
    return tail[0], "last1"

def compute_forecasts(
    quotes,
    items,
    projects,
    customer_projects,
    boiler_projects,
    parts,
    components,
    boilers,
    as_of: date | None = None,
):
    """One ForecastRow per (project, part) for the next calendar month."""
    as_of = as_of or datetime.now(timezone.utc).date()
    target = _next_month(_month_start(as_of)).isoformat()

    boiler_by_id = {b["id"]: b for b in boilers}
    component_boiler = {c["id"]: c.get("boiler_id") for c in components}

    part_meta: dict = {}
    part_boiler: dict = {}
    for p in parts:
        boiler_id = component_boiler.get(p.get("component_id"))
        part_boiler[p["id"]] = boiler_id
        part_meta[p["id"]] = {
            "part_number": p.get("part_number"),
            "name": p.get("name"),
            "boiler_code": (boiler_by_id.get(boiler_id) or {}).get("code"),
        }

    project_by_id = {p["id"]: p for p in projects}
    resolve = build_project_resolver(customer_projects, projects, boiler_projects, part_boiler)
    series, labels = build_monthly_series(quotes, items, resolve, part_meta)

    out: list[ForecastRow] = []
    for key, by_month in series.items():
        project_id, part_id = key
        months = sorted(by_month)
        values = [by_month[m] for m in months]
        predicted, method = _wma(values)
        spread = pstdev(values) if len(values) > 1 else 0.0

        boiler_code, part_number, part_name = labels.get(key, (None, None, None))
        project = project_by_id.get(project_id, {})

        out.append(
            ForecastRow(
                project_id=project_id,
                part_id=part_id,
                project_no=project.get("project_no"),
                project_name=project.get("name"),
                boiler_code=boiler_code,
                part_number=part_number,
                part_name=part_name,
                period_month=target,
                predicted_qty=round(predicted, 2),
                lower_qty=round(max(0.0, predicted - spread), 2),
                upper_qty=round(predicted + spread, 2),
                method=method,
                history_months=len(months),
                history=_contiguous_history(by_month),
            )
        )
    return out