"""FastAPI — Automated Insights endpoint with TTL cache."""

import time
from fastapi import APIRouter, Query
from typing import Optional
from services.insight_engine import generate_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])

# Simple in-process TTL cache — avoids re-running all DuckDB queries
# on every page load.  Cache key = (start_date, end_date, segment).
_CACHE: dict = {}
_TTL_SECONDS = 300   # 5 minutes


def _cache_key(start_date, end_date, segment):
    return f"{start_date}|{end_date}|{segment}"


@router.get("")
def get_insights(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    segment:    Optional[str] = Query(None),
):
    key = _cache_key(start_date, end_date, segment)
    now = time.monotonic()

    if key in _CACHE:
        payload, ts = _CACHE[key]
        if now - ts < _TTL_SECONDS:
            return payload

    insights = generate_insights(
        start_date=start_date,
        end_date=end_date,
        segment=segment,
    )
    payload = {"insights": insights, "count": len(insights)}
    _CACHE[key] = (payload, now)
    return payload
