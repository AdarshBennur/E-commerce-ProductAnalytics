"""FastAPI — Product Recommendations endpoint."""

from fastapi import APIRouter, Query
from typing import Optional
from services.recommendation_engine import generate_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("")
def get_recommendations(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
):
    recs = generate_recommendations(
        start_date=start_date,
        end_date=end_date,
    )
    return {"recommendations": recs, "count": len(recs)}
