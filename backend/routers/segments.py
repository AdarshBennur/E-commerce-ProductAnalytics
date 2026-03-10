"""FastAPI — Segmentation profiles endpoint."""

from fastapi import APIRouter, Query
from typing import Optional
from db import query, table

router = APIRouter(prefix="/api/segments", tags=["segments"])

SEGMENT_DEFINITIONS = {
    "all":               "All Users",
    "high_value_buyers": "High-Value Buyers",
    "returning_users":   "Returning Users",
    "new_users":         "New Users",
    "browse_only":       "Browse-Only",
    "one_time_buyers":   "One-Time Buyers",
}


@router.get("")
def get_segments():
    seg_tbl = table("user_segments")
    rows = query(f"""
        SELECT segment, COUNT(*) AS user_count,
               ROUND(AVG(total_spend), 2)    AS avg_spend,
               ROUND(AVG(total_sessions), 2) AS avg_sessions
        FROM {seg_tbl}
        GROUP BY segment
        ORDER BY user_count DESC
    """)

    return {
        "segments": [
            {
                "id":          s_id,
                "label":       SEGMENT_DEFINITIONS.get(s_id, s_id.replace("_", " ").title()),
                "description": _segment_description(s_id),
            }
            for s_id in SEGMENT_DEFINITIONS.keys()
        ],
        "profiles": rows,
    }


@router.get("/profile")
def get_segment_profile(segment: Optional[str] = Query(None)):
    """Return high-level KPIs for a specific user segment."""
    seg_tbl = table("user_segments")
    dau_tbl = table("daily_active_users")
    rev_tbl = table("revenue_metrics")

    all_segs = query(f"""
        SELECT segment, COUNT(*) AS user_count
        FROM {seg_tbl}
        GROUP BY segment
    """)
    total_users = sum(float(r.get("user_count") or 0) for r in all_segs)

    seg_row = None
    if segment and segment != "all":
        seg_row = next(
            (r for r in all_segs if segment.lower() in str(r.get("segment", "")).lower()),
            None,
        )

    kpis = query(f"""
        SELECT
            SUM(dau) AS total_users,
            SUM(sessions) AS total_sessions,
            SUM(purchases) AS total_purchases,
            ROUND(SUM(revenue), 2) AS total_revenue,
            CASE WHEN SUM(sessions) > 0
                 THEN ROUND(100.0 * SUM(purchases) / SUM(sessions), 3) ELSE 0 END AS cvr
        FROM {dau_tbl}
    """)

    return {
        "segment": segment or "all",
        "label": SEGMENT_DEFINITIONS.get(segment or "all", "All Users"),
        "profile": seg_row,
        "kpis": kpis[0] if kpis else {},
        "total_users": total_users,
    }


def _segment_description(seg_id: str) -> str:
    descriptions = {
        "all":               "Every user in the dataset",
        "high_value_buyers": "Users with spend in the top 20th percentile",
        "returning_users":   "Users with 2 or more sessions",
        "new_users":         "Users on their first session",
        "browse_only":       "Users who viewed products but never purchased",
        "one_time_buyers":   "Users who purchased exactly once",
    }
    return descriptions.get(seg_id, "")
