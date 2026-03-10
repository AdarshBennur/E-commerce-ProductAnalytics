"""
FastAPI — User Behavior Analysis endpoint.

Graceful degradation strategy
------------------------------
session_metrics.parquet (~1.3 GB) and session_summary.parquet may not exist
in the deployed environment (too large to commit to GitHub).

Priority order for session KPIs:
  1. session_summary  — single-row aggregate table (tiny, instant)
  2. session_metrics  — sampled DuckDB query (only if file is present)
  3. Empty dict       — return zeros / None so the page renders without crashing

All queries that touch user_segments (56 MB) use DuckDB-side GROUP BY
aggregation — raw rows are never pulled into Python memory.
"""

import os
import json
import time
from fastapi import APIRouter, Query
from typing import Optional
from db import query, table, get_table_path

router = APIRouter(prefix="/api/behavior", tags=["behavior"])

# region agent log
_DBG_LOG = "/Users/adarsh/Dashboard/.cursor/debug-0dffb0.log"
def _dbg(msg: str, data: dict, hypothesis: str):
    entry = {"sessionId":"0dffb0","timestamp":int(time.time()*1000),"location":"behavior.py","message":msg,"data":data,"hypothesisId":hypothesis}
    try:
        with open(_DBG_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass
# endregion agent log

_SESSION_SAMPLE_ROWS = 50_000   # reduced from 200k to keep memory under 256 MB limit


@router.get("")
def get_behavior(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    seg_tbl = table("user_segments")

    where_parts = []
    if start_date:
        where_parts.append(f"event_date >= '{start_date}'::DATE")
    if end_date:
        where_parts.append(f"event_date <= '{end_date}'::DATE")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    # ── Session KPIs ──────────────────────────────────────────────────────────
    session_stats = {}
    try:
        summary_path  = get_table_path("session_summary")
        metrics_path  = get_table_path("session_metrics")
        summary_exists = os.path.exists(summary_path)
        metrics_exists = os.path.exists(metrics_path)
        # region agent log
        _dbg("session table existence check", {
            "summary_path": summary_path,
            "summary_exists": summary_exists,
            "metrics_path": metrics_path,
            "metrics_exists": metrics_exists,
            "cwd": os.getcwd(),
        }, "C")
        # endregion agent log
        if summary_exists:
            rows = query(f"SELECT * FROM {table('session_summary')}")
            session_stats = rows[0] if rows else {}
            # region agent log
            _dbg("session_summary query result", {"rows_count": len(rows), "first_row": rows[0] if rows else None}, "D")
            # endregion agent log
        elif metrics_exists:
            session_tbl = table("session_metrics")
            rows = query(f"""
                SELECT
                    ROUND(AVG(view_count), 2)              AS avg_views_per_session,
                    ROUND(AVG(unique_products), 2)          AS avg_products_per_session,
                    ROUND(AVG(session_duration_minutes), 2) AS avg_session_duration_min,
                    ROUND(AVG(total_events), 2)             AS avg_events_per_session,
                    ROUND(
                        100.0 * SUM(CASE WHEN converted THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0), 3
                    ) AS session_conversion_rate,
                    COUNT(*) AS total_sessions
                FROM {session_tbl}
                USING SAMPLE {_SESSION_SAMPLE_ROWS} ROWS
                {where_clause}
            """)
            session_stats = rows[0] if rows else {}
        # else: both tables missing
    except Exception as e:
        # region agent log
        _dbg("session_stats exception", {"error": str(e)}, "B")
        # endregion agent log
        session_stats = {}

    # ── Sessions per user distribution ────────────────────────────────────────
    sessions_distribution = []
    try:
        sessions_distribution = query(f"""
            SELECT
                sessions_bucket,
                COUNT(*) AS user_count
            FROM (
                SELECT
                    user_id,
                    total_sessions,
                    CASE
                        WHEN total_sessions = 1            THEN '1'
                        WHEN total_sessions = 2            THEN '2'
                        WHEN total_sessions BETWEEN 3 AND 5  THEN '3-5'
                        WHEN total_sessions BETWEEN 6 AND 10 THEN '6-10'
                        ELSE '10+'
                    END AS sessions_bucket
                FROM {seg_tbl}
            )
            GROUP BY sessions_bucket
            ORDER BY MIN(total_sessions)
        """)
    except Exception:
        sessions_distribution = []

    # ── Hourly activity heatmap ───────────────────────────────────────────────
    hourly = []
    try:
        hourly_tbl = table("hourly_patterns")
        hourly = query(f"""
            SELECT
                day_of_week,
                hour_of_day,
                views,
                purchases,
                ROUND(revenue, 2) AS revenue
            FROM {hourly_tbl}
            ORDER BY day_of_week, hour_of_day
        """)
    except Exception:
        hourly = []

    # ── User segment distribution ─────────────────────────────────────────────
    segment_dist = []
    try:
        segment_dist = query(f"""
            SELECT
                segment,
                COUNT(*)                       AS user_count,
                ROUND(AVG(total_spend), 2)    AS avg_spend,
                ROUND(AVG(total_sessions), 2) AS avg_sessions
            FROM {seg_tbl}
            GROUP BY segment
            ORDER BY user_count DESC
        """)
    except Exception:
        segment_dist = []

    # region agent log
    _dbg("behavior endpoint returning", {
        "session_stats_keys": list(session_stats.keys()) if session_stats else [],
        "session_stats_empty": len(session_stats) == 0,
        "sessions_distribution_len": len(sessions_distribution),
        "hourly_len": len(hourly),
        "segment_dist_len": len(segment_dist),
    }, "E")
    # endregion agent log
    return {
        "session_stats":        session_stats,
        "sessions_distribution": sessions_distribution,
        "hourly_patterns":      hourly,
        "user_segments":        segment_dist,
    }
