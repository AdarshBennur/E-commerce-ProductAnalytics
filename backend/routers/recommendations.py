"""FastAPI — Product Recommendations endpoint with TTL cache."""

import time
from fastapi import APIRouter, Query
from typing import Optional
from services.recommendation_engine import generate_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

_CACHE: dict = {}
_TTL_SECONDS = 300   # 5 minutes


@router.get("")
def get_recommendations(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
):
    key = f"{start_date}|{end_date}"
    now = time.monotonic()

    if key in _CACHE:
        payload, ts = _CACHE[key]
        if now - ts < _TTL_SECONDS:
            return payload

    recs = generate_recommendations(
        start_date=start_date,
        end_date=end_date,
    )
    payload = {"recommendations": recs, "count": len(recs)}
    _CACHE[key] = (payload, now)
    return payload
