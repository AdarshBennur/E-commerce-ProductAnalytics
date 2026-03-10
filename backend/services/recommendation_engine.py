"""
Product Recommendation Engine
==============================
Translates analytics patterns into actionable product recommendations.
Reads from pre-aggregated Parquet tables — no CSV access.

Each recommendation contains:
  - id         : unique stable identifier
  - title      : short action-oriented title
  - explanation: detailed reasoning with metric context
  - metric_ref : key metric driving the recommendation
  - priority   : "critical" | "high" | "medium" | "low"
  - category   : "funnel" | "retention" | "revenue" | "catalog" | "engagement"
  - icon        : emoji shorthand for UI display
"""

import math
import statistics
from typing import Optional
from db import query, table


def _safe(v) -> float:
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return 0.0
    return float(v)


def generate_recommendations(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    recommendations: list[dict] = []

    where_parts: list[str] = []
    if start_date:
        where_parts.append(f"event_date >= '{start_date}'::DATE")
    if end_date:
        where_parts.append(f"event_date <= '{end_date}'::DATE")
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    dau_tbl = table("daily_active_users")
    rev_tbl = table("revenue_metrics")
    cat_tbl = table("category_performance")

    # ── Rule 1: Low view → cart conversion ────────────────────────────────────
    try:
        funnel_tbl = table("funnel_metrics")
        funnel = query(f"""
            SELECT
                ROUND(100.0 * SUM(carted) / NULLIF(SUM(viewers), 0), 2) AS vtc,
                ROUND(100.0 * SUM(purchasers) / NULLIF(SUM(carted), 0), 2) AS ctp,
                ROUND(100.0 * SUM(purchasers) / NULLIF(SUM(viewers), 0), 2) AS overall
            FROM {funnel_tbl}
        """)
        if funnel:
            vtc     = _safe(funnel[0]["vtc"])
            ctp     = _safe(funnel[0]["ctp"])
            overall = _safe(funnel[0]["overall"])

            if vtc < 5:
                recommendations.append({
                    "id": "rec_low_vtc",
                    "title": "Improve Product Detail Page UX",
                    "explanation": f"Only {vtc:.1f}% of viewers add items to cart — well below the 8–10% benchmark. "
                                   f"Invest in better product images, clearer CTAs, price anchoring, "
                                   f"and social proof (reviews, ratings) on product pages.",
                    "metric_ref": f"View→Cart: {vtc:.1f}%",
                    "priority": "critical",
                    "category": "funnel",
                    "icon": "🛒",
                })
            elif vtc < 10:
                recommendations.append({
                    "id": "rec_vtc_improve",
                    "title": "Optimize Add-to-Cart Experience",
                    "explanation": f"View-to-cart rate is {vtc:.1f}%. Modest gains possible through A/B testing "
                                   f"product page layouts, sticky 'Add to Cart' buttons, and urgency signals.",
                    "metric_ref": f"View→Cart: {vtc:.1f}%",
                    "priority": "medium",
                    "category": "funnel",
                    "icon": "🛒",
                })

            if ctp < 40:
                recommendations.append({
                    "id": "rec_low_ctp",
                    "title": "Reduce Cart Abandonment",
                    "explanation": f"Cart-to-purchase rate is {ctp:.1f}%. Over half of cart adds are abandoned. "
                                   f"Implement cart recovery emails, streamline checkout steps, "
                                   f"offer guest checkout, and display trust badges at payment.",
                    "metric_ref": f"Cart→Purchase: {ctp:.1f}%",
                    "priority": "high",
                    "category": "funnel",
                    "icon": "🏃",
                })
    except Exception:
        pass

    # ── Rule 2: Category revenue concentration ─────────────────────────────────
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
            LIMIT 8
        """)
        if cat_rows:
            total_rev = sum(_safe(r["revenue"]) for r in cat_rows)
            top_cat   = cat_rows[0]
            top_share = _safe(top_cat["revenue"]) / total_rev * 100 if total_rev > 0 else 0

            if top_share > 60:
                recommendations.append({
                    "id": "rec_catalog_diversify",
                    "title": "Diversify Product Catalog",
                    "explanation": f"'{top_cat['category']}' generates {top_share:.0f}% of revenue. "
                                   f"High concentration increases risk from supply disruption or demand shifts. "
                                   f"Expand catalog in the top 3 underperforming categories to reduce dependency.",
                    "metric_ref": f"{top_cat['category']} share: {top_share:.0f}%",
                    "priority": "high",
                    "category": "catalog",
                    "icon": "📦",
                })

            # Low-converting categories with high traffic
            low_cvr_cats = query(f"""
                SELECT
                    category,
                    ROUND(AVG(conversion_rate) * 100, 2) AS cvr,
                    SUM(views) AS views
                FROM {cat_tbl}
                WHERE category IS NOT NULL AND category != ''
                GROUP BY category
                HAVING SUM(views) > 1000 AND AVG(conversion_rate) < 0.02
                ORDER BY views DESC
                LIMIT 3
            """)
            if low_cvr_cats:
                names = ", ".join(f"'{r['category']}'" for r in low_cvr_cats[:2])
                recommendations.append({
                    "id": "rec_low_cvr_cats",
                    "title": "Re-merchandise Low-CVR Categories",
                    "explanation": f"Categories {names} have high traffic but below 2% conversion. "
                                   f"Review pricing competitiveness, product selection, "
                                   f"and merchandising strategy in these categories.",
                    "metric_ref": f"CVR < 2% in {len(low_cvr_cats)} categories",
                    "priority": "medium",
                    "category": "catalog",
                    "icon": "📉",
                })
    except Exception:
        pass

    # ── Rule 3: Retention signal → loyalty program ────────────────────────────
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
            w8 = next((r for r in ret_rows if r["week_number"] == 8), None)
            if w1 and w4:
                w1_ret = _safe(w1["avg_ret"])
                w4_ret = _safe(w4["avg_ret"])
                if w1_ret - w4_ret >= 20:
                    recommendations.append({
                        "id": "rec_loyalty_program",
                        "title": "Introduce a Loyalty / Rewards Program",
                        "explanation": f"Week 1 retention is {w1_ret:.1f}% but drops to {w4_ret:.1f}% by Week 4 "
                                       f"— a {w1_ret - w4_ret:.0f} point drop. "
                                       f"A points-based loyalty program or exclusive repeat-buyer offers "
                                       f"can significantly improve Month 1 retention.",
                        "metric_ref": f"Week 1→4 retention drop: {w1_ret - w4_ret:.0f} pts",
                        "priority": "high",
                        "category": "retention",
                        "icon": "🎁",
                    })

            if w1 and w8:
                w8_ret = _safe(w8["avg_ret"])
                if w8_ret < 10:
                    recommendations.append({
                        "id": "rec_winback_campaign",
                        "title": "Launch Win-Back Email Campaign",
                        "explanation": f"Only {w8_ret:.1f}% of users return after 8 weeks. "
                                       f"Automated win-back sequences (triggered at 4, 6, and 8 weeks) "
                                       f"with personalised offers can recover a significant portion of lapsed users.",
                        "metric_ref": f"Week 8 retention: {w8_ret:.1f}%",
                        "priority": "medium",
                        "category": "retention",
                        "icon": "📧",
                    })
    except Exception:
        pass

    # ── Rule 4: Repeat buyer revenue concentration ────────────────────────────
    try:
        seg_tbl = table("user_segments")
        seg_rows = query(f"SELECT * FROM {seg_tbl}")
        if seg_rows:
            total_users = sum(_safe(r.get("user_count", 0)) for r in seg_rows)
            # Find high-value segment
            hv = next((r for r in seg_rows if "high" in str(r.get("segment", "")).lower()), None)
            if hv and total_users > 0:
                hv_pct = 100 * _safe(hv.get("user_count", 0)) / total_users
                if hv_pct < 20:
                    recommendations.append({
                        "id": "rec_grow_hv_segment",
                        "title": "Grow High-Value Buyer Segment",
                        "explanation": f"High-value buyers represent only {hv_pct:.1f}% of users "
                                       f"but drive disproportionate revenue. "
                                       f"Implement a VIP tier with early access, free shipping, "
                                       f"and exclusive discounts to grow this segment.",
                        "metric_ref": f"High-value buyers: {hv_pct:.1f}% of users",
                        "priority": "high",
                        "category": "revenue",
                        "icon": "💎",
                    })
    except Exception:
        pass

    # ── Rule 5: AOV improvement ────────────────────────────────────────────────
    try:
        aov_rows = query(f"""
            SELECT
                ROUND(SUM(revenue) / NULLIF(SUM(orders), 0), 2) AS aov,
                SUM(orders) AS total_orders
            FROM {rev_tbl}
            {where_clause}
        """)
        if aov_rows:
            aov = _safe(aov_rows[0]["aov"])
            if aov < 50:
                recommendations.append({
                    "id": "rec_upsell_bundles",
                    "title": "Implement Upsell & Bundle Recommendations",
                    "explanation": f"Average order value is ${aov:.2f}. "
                                   f"Product bundles, 'frequently bought together', and post-add-to-cart upsells "
                                   f"can push AOV above the $75 benchmark for healthy e-commerce margins.",
                    "metric_ref": f"AOV: ${aov:.2f}",
                    "priority": "medium",
                    "category": "revenue",
                    "icon": "📈",
                })
    except Exception:
        pass

    # ── Rule 6: Mobile / session engagement ───────────────────────────────────
    try:
        sess_tbl = table("session_metrics")
        sess_rows = query(f"""
            SELECT
                AVG(views_per_session) AS avg_views,
                SUM(has_purchase) * 1.0 / COUNT(*) AS session_cvr
            FROM {sess_tbl}
            LIMIT 500000
        """)
        if sess_rows:
            avg_views   = _safe(sess_rows[0]["avg_views"])
            session_cvr = _safe(sess_rows[0]["session_cvr"]) * 100
            if avg_views >= 5 and session_cvr < 5:
                recommendations.append({
                    "id": "rec_personalization",
                    "title": "Deploy Personalised Product Recommendations",
                    "explanation": f"Users browse {avg_views:.1f} products/session but only {session_cvr:.1f}% purchase. "
                                   f"Collaborative filtering or content-based recommendation widgets "
                                   f"can surface more relevant products and reduce time-to-purchase.",
                    "metric_ref": f"{avg_views:.1f} views/session, {session_cvr:.1f}% session CVR",
                    "priority": "high",
                    "category": "engagement",
                    "icon": "🤖",
                })
    except Exception:
        pass

    # ── Sort: critical → high → medium → low ──────────────────────────────────
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda r: priority_order.get(r.get("priority", "low"), 3))

    return recommendations
