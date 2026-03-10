"""
FastAPI — Overview / Executive KPI endpoint.
"""

from fastapi import APIRouter, Query
from typing import Optional
from db import query, table, build_date_filter

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("")
def get_overview(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
):
    dau_tbl = table("daily_active_users")

    where_parts = []
    if start_date:
        where_parts.append(f"event_date >= '{start_date}'::DATE")
    if end_date:
        where_parts.append(f"event_date <= '{end_date}'::DATE")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    # KPI totals
    kpis = query(f"""
        SELECT
            SUM(dau) AS total_users_approx,
            SUM(sessions) AS total_sessions,
            SUM(purchases) AS total_purchases,
            SUM(revenue) AS total_revenue,
            CASE WHEN SUM(sessions) > 0
                 THEN ROUND(100.0 * SUM(purchases) / SUM(sessions), 3)
                 ELSE 0 END AS conversion_rate,
            CASE WHEN SUM(purchases) > 0
                 THEN ROUND(SUM(revenue) / SUM(purchases), 2)
                 ELSE 0 END AS avg_order_value
        FROM {dau_tbl}
        {where_clause}
    """)

    # Daily timeseries
    timeseries = query(f"""
        SELECT
            event_date::TEXT AS date,
            dau,
            sessions,
            views,
            carts,
            purchases,
            ROUND(revenue, 2) AS revenue
        FROM {dau_tbl}
        {where_clause}
        ORDER BY event_date
    """)

    return {
        "kpis": kpis[0] if kpis else {},
        "timeseries": timeseries,
        "segment": segment or "all",
    }
