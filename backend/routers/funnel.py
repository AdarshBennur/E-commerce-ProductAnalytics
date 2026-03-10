"""
FastAPI — Funnel Analysis endpoint.
"""

from fastapi import APIRouter, Query
from typing import Optional
from db import query, table

router = APIRouter(prefix="/api/funnel", tags=["funnel"])


@router.get("")
def get_funnel(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    segment: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
):
    funnel_tbl = table("funnel_metrics")

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

    # Aggregate funnel totals
    funnel = query(f"""
        SELECT
            SUM(viewers) AS viewers,
            SUM(carted) AS carted,
            SUM(purchasers) AS purchasers,
            SUM(view_events) AS view_events,
            SUM(cart_events) AS cart_events,
            SUM(purchase_events) AS purchase_events,
            CASE WHEN SUM(viewers) > 0
                 THEN ROUND(100.0 * SUM(carted) / SUM(viewers), 2) ELSE 0
            END AS view_to_cart_pct,
            CASE WHEN SUM(carted) > 0
                 THEN ROUND(100.0 * SUM(purchasers) / SUM(carted), 2) ELSE 0
            END AS cart_to_purchase_pct,
            CASE WHEN SUM(viewers) > 0
                 THEN ROUND(100.0 * SUM(purchasers) / SUM(viewers), 2) ELSE 0
            END AS overall_conversion_pct
        FROM {funnel_tbl}
        {where_clause}
    """)

    # Daily funnel timeseries
    timeseries = query(f"""
        SELECT
            event_date::TEXT AS date,
            SUM(viewers) AS viewers,
            SUM(carted) AS carted,
            SUM(purchasers) AS purchasers
        FROM {funnel_tbl}
        {where_clause}
        GROUP BY event_date
        ORDER BY event_date
    """)

    # Top categories by conversion
    top_categories = query(f"""
        SELECT
            category_main,
            SUM(viewers) AS viewers,
            SUM(purchasers) AS purchasers,
            CASE WHEN SUM(viewers) > 0
                 THEN ROUND(100.0 * SUM(purchasers) / SUM(viewers), 3) ELSE 0
            END AS conversion_rate
        FROM {funnel_tbl}
        {where_clause}
        GROUP BY category_main
        HAVING SUM(viewers) > 100
        ORDER BY conversion_rate DESC
        LIMIT 15
    """)

    return {
        "funnel": funnel[0] if funnel else {},
        "timeseries": timeseries,
        "top_categories": top_categories,
    }
