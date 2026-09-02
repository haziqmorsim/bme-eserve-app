from __future__ import annotations
from datetime import datetime, timedelta, timezone

MYT = timezone(timedelta(hours=8))
DAY = timedelta(days=1)

SLA_WARN_HOURS = 24
SLA_OVERDUE_HOURS = 48


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def weekday_hours_between(start: datetime | None, end: datetime | None) -> float | None:
    if start is None or end is None or end <= start:
        return None if start is None or end is None else 0.0

    s = start.astimezone(MYT)
    e = end.astimezone(MYT)

    cursor = s.replace(hour=0, minute=0, second=0, microsecond=0)
    total = timedelta(0)
    while cursor < e:
        nxt = cursor + DAY
        if cursor.weekday() < 5:
            frm = max(s, cursor)
            to = min(e, nxt)
            if to > frm:
                total += to - frm
        cursor = nxt
    return total.total_seconds() / 3600.0


def sla_state(hours: float | None) -> str:
    if hours is None:
        return "unknown"
    if hours >= SLA_OVERDUE_HOURS:
        return "overdue"
    if hours >= SLA_WARN_HOURS:
        return "aging"
    return "ontrack"
