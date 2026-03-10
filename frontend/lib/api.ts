/**
 * Typed API client for the analytics backend.
 * All paths proxy through Next.js rewrites → FastAPI on port 8000.
 */

import type { OverviewData, FunnelData, RetentionData, BehaviorData, CategoryData, RevenueData, FiltersData, InsightItem, RecommendationItem } from './types'

const BASE = '/api'

type QueryParams = Record<string, string | number | undefined | null>

function buildUrl(path: string, params: QueryParams = {}): string {
    const url = new URL(BASE + path, 'http://localhost:3000')
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, String(v))
        }
    })
    return url.pathname + url.search
}

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${url} returned ${res.status}: ${text}`)
    }
    return res.json()
}

export async function fetchOverview(params: QueryParams = {}): Promise<OverviewData> {
    return fetcher<OverviewData>(buildUrl('/overview', params))
}

export async function fetchFunnel(params: QueryParams = {}): Promise<FunnelData> {
    return fetcher<FunnelData>(buildUrl('/funnel', params))
}

export async function fetchRetention(): Promise<RetentionData> {
    return fetcher<RetentionData>(buildUrl('/retention'))
}

export async function fetchBehavior(params: QueryParams = {}): Promise<BehaviorData> {
    return fetcher<BehaviorData>(buildUrl('/behavior', params))
}

export async function fetchCategories(params: QueryParams = {}): Promise<CategoryData> {
    return fetcher<CategoryData>(buildUrl('/categories', params))
}

export async function fetchRevenue(params: QueryParams = {}): Promise<RevenueData> {
    return fetcher<RevenueData>(buildUrl('/revenue', params))
}

export async function fetchFilters(): Promise<FiltersData> {
    return fetcher<FiltersData>(buildUrl('/filters'))
}

export async function fetchInsights(params: QueryParams = {}): Promise<{ insights: InsightItem[]; count: number }> {
    return fetcher(buildUrl('/insights', params))
}

export async function fetchRecommendations(params: QueryParams = {}): Promise<{ recommendations: RecommendationItem[]; count: number }> {
    return fetcher(buildUrl('/recommendations', params))
}

export async function fetchSegments(): Promise<{ segments: { id: string; label: string; description: string }[]; profiles: unknown[] }> {
    return fetcher(buildUrl('/segments'))
}
