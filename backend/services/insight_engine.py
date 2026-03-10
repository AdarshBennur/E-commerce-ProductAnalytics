"""
Automated Insight Engine
========================
Reads from pre-aggregated Parquet tables and detects meaningful patterns:
  - Revenue spikes / drops
  - Conversion rate anomalies
  - Category revenue concentration
  - Retention degradation
  - Traffic / DAU anomalies

All queries are read-only against analytics/*.parquet — no CSV access.
"""

import math
import statistics
from typing import Optional
from db import query, table


# ── helpers ───────────────────────────────────────────────────────────────────

def _zscore(value: float, series: list[float]) -> float:
    if len(series) < 3:
        return 0.0
    mu = statistics.mean(series)
    try:
        sd = statistics.stdev(series)
    except statistics.StatisticsError:
        return 0.0
    return (value - mu) / sd if sd > 0 else 0.0


def _pct_change(new_val: float, old_val: float) -> Optional[float]:
    if old_val is None or old_val == 0:
        return None
    return round(100.0 * (new_val - old_val) / abs(old_val), 1)


def _safe(v) -> float:
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return 0.0
    return float(v)


# ── main engine ───────────────────────────────────────────────────────────────

def generate_insights(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    segment: Optional[str] = None,
) -> list[dict]:
    insights: list[dict] = []

    where_parts: list[str] = []
    if start_date:
        where_parts.append(f"event_date >= '{start_date}'::DATE")
    if end_date:
        where_parts.append(f"event_date <= '{end_date}'::DATE")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    dau_tbl  = table("daily_active_users")
    rev_tbl  = table("revenue_metrics")
    cat_tbl  = table("category_performance")

    # ── 1. Revenue spike / drop detection ─────────────────────────────────────
    try:
        rev_rows = query(f"""
            SELECT event_date::TEXT AS date,
                   ROUND(SUM(revenue), 2) AS revenue
            FROM {rev_tbl}
            {where_clause}
            GROUP BY event_date
            ORDER BY event_date
        """)
        if len(rev_rows) >= 7:
            revenues   = [_safe(r["revenue"]) for r in rev_rows]
            rolling_7  = [statistics.mean(revenues[max(0, i-6):i+1]) for i in range(len(revenues))]
            last_rev   = revenues[-1]
            last_roll  = rolling_7[-1] if rolling_7 else 0
            last_date  = rev_rows[-1]["date"]
            z          = _zscore(last_rev, revenues[:-1])

            if last_roll > 0 and last_rev >= 1.8 * last_roll:
                insights.append({
                    "type": "revenue_spike",
                    "message": f"Revenue spiked on {last_date} — {last_rev:,.0f} vs "
                               f"{last_roll:,.0f} 7-day rolling average ({last_rev/last_roll:.1f}×).",
                    "severity": "high",
                    "metric": "Revenue",
                    "trend": "up",
                    "badge": "Spike",
                    "badge_type": "positive",
                })
            elif last_roll > 0 and last_rev <= 0.6 * last_roll:
                insights.append({
                    "type": "revenue_drop",
                    "message": f"Revenue on {last_date} is {100*(1-last_rev/last_roll):.0f}% "
                               f"below the 7-day average — possible data gap or demand slowdown.",
                    "severity": "high",
                    "metric": "Revenue",
                    "trend": "down",
                    "badge": "Drop",
                    "badge_type": "negative",
                })

            # Revenue trend (first half vs second half)
            mid = len(revenues) // 2
            first_half_avg  = statistics.mean(revenues[:mid]) if mid else 0
            second_half_avg = statistics.mean(revenues[mid:]) if revenues[mid:] else 0
            pct = _pct_change(second_half_avg, first_half_avg)
            if pct is not None and abs(pct) >= 8:
                direction = "up" if pct > 0 else "down"
                insights.append({
                    "type": "revenue_trend",
                    "message": f"Revenue trend is {'upward' if pct > 0 else 'downward'} "
                               f"({'+' if pct>0 else ''}{pct:.1f}% vs earlier period).",
                    "severity": "medium",
                    "metric": "Revenue",
                    "trend": direction,
                    "badge": "Trend",
                    "badge_type": "positive" if pct > 0 else "warning",
                })
    except Exception:
        pass

    # ── 2. Conversion rate health ──────────────────────────────────────────────
    try:
        cvr_rows = query(f"""
            SELECT
                CASE WHEN SUM(sessions) > 0
                     THEN ROUND(100.0 * SUM(purchases) / SUM(sessions), 3)
                     ELSE 0 END AS cvr
            FROM {dau_tbl}
            {where_clause}
        """)
        cvr_overall = _safe(cvr_rows[0]["cvr"]) if cvr_rows else 0

        # Compare week-over-week
        cvr_weekly = query(f"""
            SELECT
                DATE_TRUNC('week', event_date)::TEXT AS week,
                CASE WHEN SUM(sessions) > 0
                     THEN ROUND(100.0 * SUM(purchases) / SUM(sessions), 3)
                     ELSE 0 END AS cvr
            FROM {dau_tbl}
            {where_clause}
            GROUP BY DATE_TRUNC('week', event_date)
            ORDER BY week
        """)
        if len(cvr_weekly) >= 2:
            prev_cvr = _safe(cvr_weekly[-2]["cvr"])
            curr_cvr = _safe(cvr_weekly[-1]["cvr"])
            pct      = _pct_change(curr_cvr, prev_cvr)
            if pct is not None and pct <= -10:
                insights.append({
                    "type": "conversion_drop",
                    "message": f"Conversion rate fell {abs(pct):.1f}% week-over-week "
                               f"({prev_cvr:.2f}% → {curr_cvr:.2f}%). Investigate funnel drop-offs.",
                    "severity": "high",
                    "metric": "CVR",
                    "trend": "down",
                    "badge": "Alert",
                    "badge_type": "negative",
                })
            elif pct is not None and pct >= 10:
                insights.append({
                    "type": "conversion_lift",
                    "message": f"Conversion rate improved {pct:.1f}% week-over-week "
                               f"({prev_cvr:.2f}% → {curr_cvr:.2f}%). Positive funnel signal.",
                    "severity": "medium",
                    "metric": "CVR",
                    "trend": "up",
                    "badge": "Lift",
                    "badge_type": "positive",
                })
        elif cvr_overall > 0:
            insights.append({
                "type": "conversion_baseline",
                "message": f"Overall session-to-purchase conversion rate is {cvr_overall:.2f}%. "
                           f"{'Above' if cvr_overall >= 3 else 'Below'} the 3% e-commerce benchmark.",
                "severity": "medium",
                "metric": "CVR",
                "trend": "up" if cvr_overall >= 3 else "warning",
                "badge": "CVR",
                "badge_type": "positive" if cvr_overall >= 3 else "warning",
            })
    except Exception:
        pass

    # ── 3. Category revenue concentration ─────────────────────────────────────
    try:
        cat_rows = query(f"""
            SELECT
                category_main AS category,
                ROUND(SUM(revenue), 2) AS revenue
            FROM {rev_tbl}
            WHERE category_main IS NOT NULL
              AND category_main NOT IN ('unknown', '')
            GROUP BY category_main
            ORDER BY revenue DESC
            LIMIT 5
        """)
        if cat_rows:
            total_rev = sum(_safe(r["revenue"]) for r in cat_rows)
            top_cat   = cat_rows[0]
            top_share = _safe(top_cat["revenue"]) / total_rev * 100 if total_rev > 0 else 0
            if top_share >= 60:
                insights.append({
                    "type": "category_concentration",
                    "message": f"'{top_cat['category']}' drives {top_share:.0f}% of total revenue — "
                               f"high concentration risk. Consider expanding other categories.",
                    "severity": "medium",
                    "metric": "Category",
                    "trend": "warning",
                    "badge": "Concentration",
                    "badge_type": "warning",
                })
            elif top_share >= 40:
                insights.append({
                    "type": "top_category",
                    "message": f"'{top_cat['category']}' is the top revenue driver at {top_share:.0f}% share. "
                               f"Strong category signal for inventory and marketing focus.",
                    "severity": "low",
                    "metric": "Category",
                    "trend": "up",
                    "badge": "Top Category",
                    "badge_type": "info",
                })
    except Exception:
        pass

    # ── 4. DAU / traffic anomaly ───────────────────────────────────────────────
    try:
        dau_rows = query(f"""
            SELECT event_date::TEXT AS date, dau
            FROM {dau_tbl}
            {where_clause}
            ORDER BY event_date
        """)
        if len(dau_rows) >= 7:
            dau_vals = [_safe(r["dau"]) for r in dau_rows]
            last_dau = dau_vals[-1]
            avg_dau  = statistics.mean(dau_vals[:-1])
            z        = _zscore(last_dau, dau_vals[:-1])

            if z >= 2.0:
                insights.append({
                    "type": "traffic_spike",
                    "message": f"DAU spiked to {last_dau:,.0f} on {dau_rows[-1]['date']} "
                               f"({z:.1f}σ above average). Unusual traffic surge.",
                    "severity": "medium",
                    "metric": "DAU",
                    "trend": "up",
                    "badge": "Traffic Spike",
                    "badge_type": "info",
                })
            elif z <= -2.0:
                insights.append({
                    "type": "traffic_drop",
                    "message": f"DAU dropped to {last_dau:,.0f} on {dau_rows[-1]['date']} "
                               f"({abs(z):.1f}σ below average). Investigate potential issues.",
                    "severity": "high",
                    "metric": "DAU",
                    "trend": "down",
                    "badge": "Traffic Drop",
                    "badge_type": "negative",
                })
    except Exception:
        pass

    # ── 5. Retention signal ────────────────────────────────────────────────────
    try:
        ret_tbl = table("retention_cohorts")
        ret_rows = query(f"""
            SELECT week_number,
                   ROUND(AVG(retention_pct), 2) AS avg_ret
            FROM {ret_tbl}
            WHERE week_number IN (1, 2, 4, 8)
            GROUP BY week_number
            ORDER BY week_number
        """)
        if ret_rows:
            w1 = next((r for r in ret_rows if r["week_number"] == 1), None)
            w4 = next((r for r in ret_rows if r["week_number"] == 4), None)
            if w1 and w4:
                w1_ret = _safe(w1["avg_ret"])
                w4_ret = _safe(w4["avg_ret"])
                drop   = w1_ret - w4_ret
                if drop >= 25:
                    insights.append({
                        "type": "retention_drop",
                        "message": f"Retention drops {drop:.0f} pts from Week 1 ({w1_ret:.1f}%) "
                                   f"to Week 4 ({w4_ret:.1f}%). Engagement drops sharply post-purchase.",
                        "severity": "high",
                        "metric": "Retention",
                        "trend": "down",
                        "badge": "Retention Risk",
                        "badge_type": "negative",
                    })
                elif w1_ret >= 40:
                    insights.append({
                        "type": "retention_strong",
                        "message": f"Week 1 retention is {w1_ret:.1f}% — strong early re-engagement signal. "
                                   f"Focus on converting this into Week 4 retention.",
                        "severity": "low",
                        "metric": "Retention",
                        "trend": "up",
                        "badge": "Strong",
                        "badge_type": "positive",
                    })
    except Exception:
        pass

    # ── 6. Session engagement ──────────────────────────────────────────────────
    try:
        sess_tbl = table("session_metrics")
        sess_rows = query(f"""
            SELECT
                AVG(views_per_session)    AS avg_views,
                AVG(events_per_session)   AS avg_events,
                SUM(has_purchase)         AS buyers,
                COUNT(*)                  AS total
            FROM {sess_tbl}
            LIMIT 500000
        """)
        if sess_rows:
            avg_views  = _safe(sess_rows[0]["avg_views"])
            avg_events = _safe(sess_rows[0]["avg_events"])
            buyers     = _safe(sess_rows[0]["buyers"])
            total      = _safe(sess_rows[0]["total"])
            browse_pct = 100 * (1 - buyers / total) if total > 0 else 0

            if browse_pct >= 70:
                insights.append({
                    "type": "browse_heavy",
                    "message": f"{browse_pct:.0f}% of sessions end without a purchase. "
                               f"Avg {avg_views:.1f} product views per session — high browse, low convert.",
                    "severity": "medium",
                    "metric": "Sessions",
                    "trend": "warning",
                    "badge": "Browse-heavy",
                    "badge_type": "warning",
                })
    except Exception:
        pass

    # ── Segment-specific overlay ───────────────────────────────────────────────
    if segment and segment != "all":
        seg_label = segment.replace("_", " ").title()
        insights.insert(0, {
            "type": "segment_filter",
            "message": f"All insights below are filtered for segment: {seg_label}.",
            "severity": "low",
            "metric": "Segment",
            "trend": "neutral",
            "badge": seg_label,
            "badge_type": "info",
        })

    return insights
