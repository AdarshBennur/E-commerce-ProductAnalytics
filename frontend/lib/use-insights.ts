'use client'

import { useState, useEffect } from 'react'
import { fetchInsights } from './api'
import type { InsightItem } from './types'
import type { Insight, InsightTrend, InsightBadge } from '@/components/analytics/KeyInsightsPanel'

/**
 * Maps a raw InsightItem from /api/insights into the Insight shape
 * expected by <KeyInsightsPanel>.
 */
function mapInsight(item: InsightItem): Insight {
    const trendMap: Record<string, InsightTrend> = {
        up:      'up',
        down:    'down',
        neutral: 'neutral',
        warning: 'warning',
    }
    const badgeMap: Record<string, InsightBadge> = {
        positive:  'positive',
        negative:  'negative',
        info:      'info',
        warning:   'warning',
        highlight: 'highlight',
    }
    return {
        text:      item.message,
        metric:    item.metric,
        trend:     trendMap[item.trend ?? 'neutral'] ?? 'neutral',
        badge:     item.badge,
        badgeType: badgeMap[item.badge_type ?? 'info'] ?? 'info',
        highlight: item.severity === 'high',
    }
}

interface UseInsightsOptions {
    startDate?: string
    endDate?:   string
    segment?:   string
    /** Pass static insights to merge before live insights (overrides loading state for static) */
    staticInsights?: Insight[]
}

export function useInsights({
    startDate,
    endDate,
    segment,
    staticInsights = [],
}: UseInsightsOptions = {}) {
    const [liveInsights, setLiveInsights] = useState<Insight[]>([])
    const [loading,      setLoading]      = useState(true)

    useEffect(() => {
        setLoading(true)
        fetchInsights({
            start_date: startDate,
            end_date:   endDate,
            segment:    segment,
        })
            .then(data => setLiveInsights(data.insights.map(mapInsight)))
            .catch(() => setLiveInsights([]))
            .finally(() => setLoading(false))
    }, [startDate, endDate, segment])

    // Merge: static insights (computed locally from page data) come first,
    // then live backend insights for broader signal coverage.
    const merged = [...staticInsights, ...liveInsights]

    return { insights: merged, loading }
}
