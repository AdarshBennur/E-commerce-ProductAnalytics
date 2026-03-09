/**
 * Analytics utility functions for insight generation, spike detection,
 * trend computation, and period comparison.
 */

// ── Generic row type so pages can pass any timeseries shape ───────────────
export type AnyRow = Record<string, unknown> & { date?: string }

// ── Trend computation ──────────────────────────────────────────────────────
// Splits the timeseries into two equal halves and computes % change.

export interface TrendResult {
    pct:     number   // positive = growth
    current: number   // avg of recent half
    prev:    number   // avg of older half
    dir:     'up' | 'down' | 'neutral'
}

export function computeTrend(
    ts: AnyRow[],
    metric: string,
): TrendResult {
    if (!ts || ts.length < 4) return { pct: 0, current: 0, prev: 0, dir: 'neutral' }
    const half      = Math.floor(ts.length / 2)
    const prevSlice = ts.slice(0, half)
    const currSlice = ts.slice(half)
    const avg = (arr: AnyRow[]) =>
        arr.reduce((s, t) => s + (Number(t[metric]) || 0), 0) / arr.length
    const prev    = avg(prevSlice)
    const current = avg(currSlice)
    const pct     = prev > 0 ? ((current - prev) / prev) * 100 : 0
    return { pct, current, prev, dir: pct > 1 ? 'up' : pct < -1 ? 'down' : 'neutral' }
}

// ── Spike detection ────────────────────────────────────────────────────────
// Returns dates where the metric is > mean + threshold * stdDev

export interface Spike {
    date:      string
    value:     number
    label:     string
    z:         number   // standard deviations above mean
}

export function detectSpikes(
    ts: AnyRow[],
    metric: string,
    threshold = 1.6,
    maxSpikes = 3,
): Spike[] {
    if (!ts || ts.length < 5) return []
    const vals  = ts.map(t => Number(t[metric]) || 0)
    const mean  = vals.reduce((a, b) => a + b, 0) / vals.length
    const std   = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
    if (std === 0) return []

    return ts
        .map((t, i) => ({ ...t, _val: vals[i], _z: (vals[i] - mean) / std }))
        .filter(t => t._z >= threshold)
        .sort((a, b) => b._z - a._z)
        .slice(0, maxSpikes)
        .map(t => ({
            date:  t.date as string ?? '',
            value: t._val,
            label: t._z >= 2.5 ? 'Major Spike' : 'Traffic Spike',
            z:     t._z,
        }))
}

// ── Period comparison label ────────────────────────────────────────────────

export function trendLabel(tsLength: number): string {
    if (tsLength >= 28) return 'vs prev half'
    if (tsLength >= 14) return 'vs prev week'
    return 'vs prev period'
}

// ── Summary stats ──────────────────────────────────────────────────────────

export function maxPoint(ts: AnyRow[], metric: string) {
    if (!ts || ts.length === 0) return null
    return ts.reduce((best, t) =>
        (Number(t[metric]) || 0) > (Number(best[metric]) || 0) ? t : best
    )
}

export function sumMetric(ts: AnyRow[], metric: string): number {
    return ts.reduce((s, t) => s + (Number(t[metric]) || 0), 0)
}

export function avgMetric(ts: AnyRow[], metric: string): number {
    if (!ts || ts.length === 0) return 0
    return sumMetric(ts, metric) / ts.length
}

// ── Formatting helpers for insight text ───────────────────────────────────

export function fmtDate(d: string): string {
    if (!d) return ''
    try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return d }
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
    if (n == null) return '—'
    return `${n.toFixed(digits)}%`
}
