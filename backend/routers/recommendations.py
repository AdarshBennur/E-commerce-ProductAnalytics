"""FastAPI — Product Recommendations endpoint."""

import time
from fastapi import APIRouter, Query
from typing import Optional
from services.recommendation_engine import generate_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

# ── Simple in-memory TTL cache ────────────────────────────────────────────────
# Recommendations are derived from slowly-changing parquet files, so caching
# for 5 minutes eliminates redundant DuckDB scans on every page load.

_CACHE_TTL_SECONDS = 300   # 5 minutes

_cache: dict[str, tuple[float, list]] = {}   # key → (timestamp, payload)


def _cache_key(start_date: Optional[str], end_date: Optional[str]) -> str:
    return f"{start_date or '*'}|{end_date or '*'}"


@router.get("")
def get_recommendations(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
):
    key = _cache_key(start_date, end_date)
    now = time.monotonic()

    cached = _cache.get(key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        recs = cached[1]
        return {"recommendations": recs, "count": len(recs), "cached": True}

    recs = generate_recommendations(start_date=start_date, end_date=end_date)
    _cache[key] = (now, recs)

    return {"recommendations": recs, "count": len(recs), "cached": False}
