"""FastAPI — Automated Insights endpoint."""

from fastapi import APIRouter, Query
from typing import Optional
from services.insight_engine import generate_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("")
def get_insights(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    segment:    Optional[str] = Query(None),
):
    insights = generate_insights(
        start_date=start_date,
        end_date=end_date,
        segment=segment,
    )
    return {"insights": insights, "count": len(insights)}
