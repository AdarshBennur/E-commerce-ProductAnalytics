'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchBehavior } from '@/lib/api'
import type { BehaviorData } from '@/lib/types'
import { formatNumber, formatPct } from '@/lib/utils'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { KpiSkeleton, InlineChartSkeleton } from '@/components/ui/Skeleton'
import { ChartCard } from '@/components/ui/ChartCard'
import { KpiCard } from '@/components/ui/KpiCard'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/analytics/MetricTooltip'
import { fmtPct } from '@/lib/analytics'
import { useInsights } from '@/lib/use-insights'
import { useFilters } from '@/lib/filter-context'
import { Clock, MousePointerClick, Users, Activity, ShoppingBag, TrendingUp } from 'lucide-react'

const PALETTE = ['#4F46E5', '#2563EB', '#14B8A6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function heatColor(v: number, max: number) {
    if (!v || !max) return { bg: 'rgba(241,245,249,0.5)', fg: '#cbd5e1' }
    const n = v / max
    if (n > 0.85) return { bg: '#3730A3', fg: '#fff' }
    if (n > 0.65) return { bg: '#4338CA', fg: '#fff' }
    if (n > 0.45) return { bg: '#4F46E5', fg: '#fff' }
    if (n > 0.25) return { bg: '#6366F1', fg: '#fff' }
    if (n > 0.10) return { bg: '#A5B4FC', fg: '#3730A3' }
    return { bg: '#EEF2FF', fg: '#4338CA' }
}

function buildInsights(data: BehaviorData): Insight[] {
    const { session_stats: s, user_segments: segs } = data
    const insights: Insight[] = []

    // Browsing without purchasing
    const browsePct = 100 - (s.session_conversion_rate ?? 0)
    insights.push({
        text:      `${fmtPct(browsePct)} of sessions end without a purchase — most users are browsing and exploring, not buying.`,
        metric:    'Session CVR',
        trend:     'neutral',
        badge:     'Browse-Heavy',
        badgeType: 'info',
        highlight: true,
    })

    // High-value buyers segment
    const highValue = segs.find(sg => sg.segment.toLowerCase().includes('high') || sg.avg_spend > 200)
    if (highValue) {
        const total = segs.reduce((sum, sg) => sum + sg.user_count, 0)
        const pct   = (highValue.user_count / total) * 100
        insights.push({
            text:      `High-value buyers (avg spend $${highValue.avg_spend.toFixed(0)}) represent just ${pct.toFixed(1)}% of users but are the primary revenue driver.`,
            metric:    'User Segments',
            trend:     'up',
            badge:     'High Value',
            badgeType: 'highlight',
        })
    }

    // Session engagement
    if (s.avg_views_per_session > 0) {
        insights.push({
            text:      `Users view an average of ${s.avg_views_per_session.toFixed(1)} products per session with ${s.avg_events_per_session.toFixed(0)} total interactions — ${s.avg_views_per_session > 5 ? 'strong product exploration behaviour' : 'relatively shallow exploration per visit'}.`,
            metric:    'Engagement',
            trend:     s.avg_views_per_session > 5 ? 'up' : 'neutral',
        })
    }

    // Session frequency
    if (s.avg_session_duration_min > 0) {
        insights.push({
            text:      `Average session lasts ${s.avg_session_duration_min.toFixed(1)} minutes. ${s.avg_session_duration_min > 10 ? 'Users spend significant time browsing, suggesting engaged discovery behaviour.' : 'Short sessions suggest users know what they want and browse with intent.'}`,
            metric:    'Session Duration',
            trend:     'neutral',
        })
    }

    return insights
}

export default function BehaviorPage() {
    const { filters }           = useFilters()
    const [data, setData]       = useState<BehaviorData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchBehavior()
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false))
    }, [])

    const stats    = data?.session_stats
    const segments = data?.user_segments   ?? []
    const heatmap  = data?.hourly_patterns ?? []
    const sessHist = data?.sessions_distribution ?? []

    const hmMax = Math.max(...heatmap.map(c => c.views), 1)
    const hmMap = new Map(heatmap.map(c => [`${c.day_of_week}:${c.hour_of_day}`, c.views]))

    const segmentData = segments.map(s => ({
        segment_name:  s.segment,
        user_count:    s.user_count,
    }))

    const sessDistData = sessHist.map(s => ({
        bucket:        s.sessions_bucket,
        session_count: s.user_count,
    }))

    const staticInsights = useMemo(() => (data ? buildInsights(data) : []), [data])
    const { insights }   = useInsights({
        segment:        filters.segment || undefined,
        staticInsights,
    })

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4">
                {loading ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />) : <>
                    <KpiCard label="Avg Duration"    value={stats?.avg_session_duration_min != null ? `${stats.avg_session_duration_min.toFixed(1)}m` : '—'} sub="Per session"         icon={<Clock            className="w-4 h-4" />} accent="blue"   />
                    <KpiCard label="Events/Session"  value={stats?.avg_events_per_session?.toFixed(1) ?? '—'}                                               sub="Interactions"         icon={<MousePointerClick className="w-4 h-4" />} accent="purple" />
                    <KpiCard label="Avg Views"       value={stats?.avg_views_per_session?.toFixed(1) ?? '—'}                                                sub="Product views"        icon={<Users             className="w-4 h-4" />} accent="green"  />
                    <KpiCard label="Avg Products"    value={stats?.avg_products_per_session?.toFixed(1) ?? '—'}                                             sub="Unique products seen" icon={<ShoppingBag       className="w-4 h-4" />} accent="orange" />
                    <KpiCard
                        label="Session CVR" value={formatPct(stats?.session_conversion_rate)}
                        sub="Sessions w/ purchase"
                        icon={<TrendingUp className="w-4 h-4" />} accent="rose"
                        labelNode={<MetricTooltip {...METRIC_DEFINITIONS.sessionCvr} />}
                    />
                    <KpiCard label="Total Sessions"  value={formatNumber(stats?.total_sessions)}  sub="All sessions"         icon={<Activity          className="w-4 h-4" />} accent="teal"   />
                </>}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <ChartCard title="User Segments" subtitle="Breakdown by purchase behaviour">
                    {loading ? <InlineChartSkeleton height={260} /> : (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width={220} height={220}>
                                <PieChart>
                                    <Pie
                                        data={segmentData} cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="user_count" nameKey="segment_name"
                                        strokeWidth={0}
                                        isAnimationActive
                                    >
                                        {segmentData.map((_, i) => (
                                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [formatNumber(v), 'Users']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2.5">
                                {segmentData.slice(0, 6).map((s, i) => {
                                    const total = segmentData.reduce((sum, sg) => sum + sg.user_count, 0)
                                    const pct   = total > 0 ? (s.user_count / total * 100).toFixed(1) : '0'
                                    return (
                                        <div key={s.segment_name} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                                <span className="text-xs font-medium text-slate-600 truncate max-w-[100px]">{s.segment_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-slate-800 tabular-nums block">{formatNumber(s.user_count)}</span>
                                                <span className="text-[9px] text-slate-400">{pct}%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Sessions Distribution" subtitle="Users grouped by session frequency">
                    {loading ? <InlineChartSkeleton height={260} /> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={sessDistData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                                <XAxis dataKey="bucket" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_TICK} tickFormatter={formatNumber} width={44} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v: any) => [formatNumber(v), 'Users']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                                <Bar dataKey="session_count" radius={[6, 6, 0, 0]} isAnimationActive>
                                    {sessDistData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Purchase Activity Heatmap */}
            <div className="card animate-fade-in overflow-x-auto">
                <div className="mb-4">
                    <h3 className="section-title">Purchase Activity by Hour &amp; Day</h3>
                    <p className="section-sub">When do users buy? Intensity = relative purchase volume</p>
                </div>

                {loading ? <InlineChartSkeleton height={168} /> : (
                    <div className="min-w-[600px]">
                        <div className="flex mb-1.5" style={{ paddingLeft: '36px' }}>
                            {HOURS.map(h => (
                                <div key={h} className="flex-1 text-center">
                                    {h % 6 === 0 && (
                                        <span className="text-[9.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                            {h}h
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {DAYS.map((day, d) => (
                            <div key={d} className="flex items-center gap-[5px] mb-[3px]">
                                <div className="text-right flex-shrink-0 text-[10px] font-semibold" style={{ width: '28px', color: 'var(--text-secondary)' }}>
                                    {day}
                                </div>
                                <div className="flex gap-[2px] flex-1">
                                    {HOURS.map(h => {
                                        const v   = hmMap.get(`${d}:${h}`) ?? 0
                                        const { bg } = heatColor(v, hmMax)
                                        return (
                                            <div
                                                key={h}
                                                className="flex-1 rounded-[4px] cursor-default transition-opacity duration-100 hover:opacity-80"
                                                style={{ background: bg, height: '22px' }}
                                                title={`${day} ${String(h).padStart(2,'0')}:00 — ${formatNumber(v)} views`}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center gap-1.5 mt-3 justify-end">
                            <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Low</span>
                            {[0, 0.12, 0.28, 0.50, 0.72, 1].map(v => {
                                const { bg } = heatColor(v * hmMax, hmMax)
                                return <div key={v} className="w-4 h-4 rounded-[3px]" style={{ background: bg }} />
                            })}
                            <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>High</span>
                        </div>
                    </div>
                )}
            </div>

        </div>{/* end main content */}

        {/* ── Right insights panel ──────────────────────────────── */}
        <aside className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky" style={{ top: 'calc(var(--header-height, 64px) + 20px)' }}>
                <KeyInsightsPanel
                    insights={insights}
                    loading={loading}
                />
            </div>
        </aside>

        </div>
    )
}
