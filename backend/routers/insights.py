"""FastAPI — Automated Insights endpoint."""

import time
from fastapi import APIRouter, Query
from typing import Optional
from services.insight_engine import generate_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])

_CACHE_TTL_SECONDS = 300   # 5 minutes
_cache: dict[str, tuple[float, list]] = {}


def _cache_key(start_date: Optional[str], end_date: Optional[str], segment: Optional[str]) -> str:
    return f"{start_date or '*'}|{end_date or '*'}|{segment or '*'}"


@router.get("")
def get_insights(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    segment:    Optional[str] = Query(None),
):
    key = _cache_key(start_date, end_date, segment)
    now = time.monotonic()

    cached = _cache.get(key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        insights = cached[1]
        return {"insights": insights, "count": len(insights), "cached": True}

    insights = generate_insights(start_date=start_date, end_date=end_date, segment=segment)
    _cache[key] = (now, insights)

    return {"insights": insights, "count": len(insights), "cached": False}
