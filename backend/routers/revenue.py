"""
FastAPI — Revenue Analytics endpoint.
"""

from fastapi import APIRouter, Query
from typing import Optional
from db import query, table

router = APIRouter(prefix="/api/revenue", tags=["revenue"])


@router.get("")
def get_revenue(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    granularity: str = Query("daily"),  # daily | weekly
    segment: Optional[str] = Query(None),
):
    rev_tbl = table("revenue_metrics")
    dau_tbl = table("daily_active_users")

    where_parts = []
    if start_date:
        where_parts.append(f"event_date >= '{start_date}'::DATE")
    if end_date:
        where_parts.append(f"event_date <= '{end_date}'::DATE")
    if category:
        where_parts.append(f"LOWER(category_main) = LOWER('{category}')")
    if brand:
        where_parts.append(f"LOWER(brand) = LOWER('{brand}')")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    # Revenue KPIs
    kpis = query(f"""
        SELECT
            ROUND(SUM(revenue), 2) AS total_revenue,
            SUM(orders) AS total_orders,
            ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2) AS avg_order_value,
            COUNT(DISTINCT unique_buyers) AS unique_buyers
        FROM {rev_tbl}
        {where_clause}
    """)

    # Revenue timeseries (grouped by granularity)
    date_trunc = "DATE_TRUNC('week', event_date)" if granularity == "weekly" else "event_date"
    timeseries = query(f"""
        SELECT
            {date_trunc}::TEXT AS date,
            ROUND(SUM(revenue), 2) AS revenue,
            SUM(orders) AS orders,
            ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2) AS aov
        FROM {rev_tbl}
        {where_clause}
        GROUP BY {date_trunc}
        ORDER BY {date_trunc}
    """)

    # Revenue by category (top 10)
    by_category = query(f"""
        SELECT
            category_main AS category,
            ROUND(SUM(revenue), 2) AS revenue,
            SUM(orders) AS orders,
            ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2) AS aov
        FROM {rev_tbl}
        WHERE category_main != 'unknown' AND category_main != ''
        {('AND ' + ' AND '.join([p for p in where_parts if 'category_main' not in p and 'brand' not in p])) if any(p for p in where_parts if 'category_main' not in p and 'brand' not in p) else ''}
        GROUP BY category_main
        ORDER BY revenue DESC
        LIMIT 10
    """)

    return {
        "kpis": kpis[0] if kpis else {},
        "timeseries": timeseries,
        "by_category": by_category,
    }
