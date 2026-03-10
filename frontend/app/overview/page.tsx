'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFilters } from '@/lib/filter-context'
import { fetchOverview } from '@/lib/api'
import type { OverviewData } from '@/lib/types'
import { KpiCard } from '@/components/ui/KpiCard'
import { KpiSkeleton, InlineChartSkeleton } from '@/components/ui/Skeleton'
import { ChartCard, ToggleGroup } from '@/components/ui/ChartCard'
import { ChartTooltip } from '@/components/ui/ChartTooltip'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/analytics/MetricTooltip'
import { DrillDownModal, ModalKpi, ModalStatRow } from '@/components/analytics/DrillDownModal'
import { SpikeAnnotations, AnnotationLegend } from '@/components/analytics/ChartAnnotations'
import { computeTrend, detectSpikes, trendLabel, maxPoint, fmtDate, fmtPct } from '@/lib/analytics'
import { useInsights } from '@/lib/use-insights'
import { ProductRecommendations } from '@/components/analytics/ProductRecommendations'
import { formatNumber, formatCurrency, formatPct, formatDate } from '@/lib/utils'
import {
    AreaChart, Area, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Users, ShoppingCart, DollarSign, TrendingUp, Package, Activity } from 'lucide-react'

const C = {
    dau:       '#4F46E5',
    sessions:  '#2563EB',
    purchases: '#10B981',
    revenue:   '#F59E0B',
    views:     '#4F46E5',
    carts:     '#14B8A6',
}
const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

// ── Insight generator ──────────────────────────────────────────────────────
function buildInsights(data: OverviewData): Insight[] {
    const { kpis, timeseries: ts } = data
    const insights: Insight[] = []

    // Peak DAU day
    const peak = maxPoint(ts, 'dau')
    if (peak?.dau && peak.date) {
        insights.push({
            text:      `Daily active users peaked on ${fmtDate(String(peak.date))} with ${formatNumber(Number(peak.dau))} unique visitors — the highest day in this period.`,
            metric:    'DAU',
            trend:     'up',
            badge:     'Peak Day',
            badgeType: 'highlight',
            highlight: true,
        })
    }

    // Conversion rate signal
    const cvr = kpis.conversion_rate
    insights.push({
        text:      `Overall session-to-purchase conversion is ${fmtPct(cvr)} — ${cvr > 6 ? 'above average, indicating strong purchase intent' : 'moderate, suggesting room to optimise the checkout path'}.`,
        metric:    'CVR',
        trend:     cvr > 6 ? 'up' : 'neutral',
        badge:     cvr > 6 ? 'Strong' : 'Moderate',
        badgeType: cvr > 6 ? 'positive' : 'info',
    })

    // Revenue trend
    const revTrend = computeTrend(ts, 'revenue')
    if (Math.abs(revTrend.pct) > 3) {
        insights.push({
            text:      `Revenue ${revTrend.dir === 'up' ? 'grew' : 'declined'} ${Math.abs(revTrend.pct).toFixed(1)}% in the second half of this period compared to the first.`,
            metric:    'Revenue',
            trend:     revTrend.dir,
            badge:     revTrend.dir === 'up' ? '+Trend' : '-Trend',
            badgeType: revTrend.dir === 'up' ? 'positive' : 'negative',
        })
    }

    // Sessions vs DAU
    const avgSessPerUser = kpis.total_sessions / Math.max(kpis.total_users_approx, 1)
    insights.push({
        text:      `Users average ${avgSessPerUser.toFixed(1)} sessions per person, suggesting ${avgSessPerUser > 2 ? 'strong re-engagement and habitual browsing' : 'mostly single-session visits with lower repeat usage'}.`,
        metric:    'Sessions / User',
        trend:     avgSessPerUser > 2 ? 'up' : 'neutral',
    })

    // AOV signal
    if (kpis.avg_order_value > 0) {
        insights.push({
            text:      `Average order value is ${formatCurrency(kpis.avg_order_value)}, with ${formatNumber(kpis.total_purchases)} total purchases generating ${formatCurrency(kpis.total_revenue)} GMV.`,
            metric:    'AOV',
            trend:     'neutral',
        })
    }

    return insights
}

export default function OverviewPage() {
    const { filters } = useFilters()
    const [data, setData]         = useState<OverviewData | null>(null)
    const [loading, setLoading]   = useState(true)
    const [error, setError]       = useState<string | null>(null)
    const [chartMode, setChartMode] = useState<'area' | 'line'>('area')
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
    const [drillOpen, setDrillOpen]       = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            setData(await fetchOverview({
                start_date: filters.startDate || undefined,
                end_date:   filters.endDate   || undefined,
                segment:    filters.segment   || undefined,
            }))
        } catch (e: any) { setError(e.message) }
        finally { setLoading(false) }
    }, [filters.startDate, filters.endDate, filters.segment])

    useEffect(() => { load() }, [load])

    const kpis          = data?.kpis
    const ts            = data?.timeseries ?? []
    const staticInsights = useMemo(() => (data ? buildInsights(data) : []), [data])
    const { insights }  = useInsights({
        startDate:      filters.startDate || undefined,
        endDate:        filters.endDate   || undefined,
        segment:        filters.segment   || undefined,
        staticInsights,
    })
    const spikes   = useMemo(() => detectSpikes(ts, 'dau'), [ts])

    // Trend computations for KPI cards
    const dauTrend  = useMemo(() => computeTrend(ts, 'dau'),      [ts])
    const sessTrend = useMemo(() => computeTrend(ts, 'sessions'),  [ts])
    const revTrend  = useMemo(() => computeTrend(ts, 'revenue'),   [ts])
    const tLabel    = trendLabel(ts.length)

    const toggleSeries = (name: string) => {
        setHiddenSeries(prev => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
        })
    }

    if (error) return (
        <div className="flex items-center justify-center h-64">
            <div className="card text-center px-8 py-10 max-w-sm">
                <p className="text-[15px] font-semibold text-slate-700 mb-1">Unable to load data</p>
                <p className="text-slate-400 text-xs">The backend service may be starting up. Please wait 30 seconds and refresh.</p>
            </div>
        </div>
    )

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
                    : <>
                        <KpiCard
                            label="Total Users" value={formatNumber(kpis?.total_users_approx)}
                            sub="Unique visitors"
                            trend={dauTrend.pct} trendLabel={tLabel}
                            icon={<Users className="w-4 h-4" />} accent="blue"
                            onClick={() => setDrillOpen(true)}
                            labelNode={<MetricTooltip {...METRIC_DEFINITIONS.dau} />}
                        />
                        <KpiCard
                            label="Sessions" value={formatNumber(kpis?.total_sessions)}
                            sub="All user sessions"
                            trend={sessTrend.pct} trendLabel={tLabel}
                            icon={<Activity className="w-4 h-4" />} accent="purple"
                            labelNode={<MetricTooltip {...METRIC_DEFINITIONS.sessions} />}
                        />
                        <KpiCard label="Purchases" value={formatNumber(kpis?.total_purchases)} sub="Completed orders" icon={<ShoppingCart className="w-4 h-4" />} accent="green"  />
                        <KpiCard
                            label="Revenue" value={formatCurrency(kpis?.total_revenue)}
                            sub="Total GMV"
                            trend={revTrend.pct} trendLabel={tLabel}
                            icon={<DollarSign className="w-4 h-4" />} accent="orange"
                            labelNode={<MetricTooltip {...METRIC_DEFINITIONS.gmv} />}
                        />
                        <KpiCard
                            label="Conversion Rate" value={formatPct(kpis?.conversion_rate)}
                            sub="Session → Purchase"
                            icon={<TrendingUp className="w-4 h-4" />} accent="green"
                            labelNode={<MetricTooltip {...METRIC_DEFINITIONS.conversionRate} />}
                        />
                        <KpiCard
                            label="Avg Order Value" value={formatCurrency(kpis?.avg_order_value)}
                            sub="Per transaction"
                            icon={<Package className="w-4 h-4" />} accent="blue"
                            labelNode={<MetricTooltip {...METRIC_DEFINITIONS.aov} />}
                        />
                    </>
                }
            </div>

            {/* Row 1: DAU/Sessions + Purchases/Revenue */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <ChartCard
                    title="Daily Active Users & Sessions"
                    subtitle="Unique visitors and total sessions per day"
                    action={
                        <div className="flex items-center gap-3">
                            <AnnotationLegend count={spikes.length} />
                            <div className="flex gap-1">
                                {['DAU', 'Sessions'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => toggleSeries(s)}
                                        className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                                            hiddenSeries.has(s)
                                                ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    }
                >
                    {loading ? <InlineChartSkeleton height={240} /> : (
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={ts} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                                <defs>
                                    <linearGradient id="gDau" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={C.dau}      stopOpacity={0.20} />
                                        <stop offset="95%" stopColor={C.dau}      stopOpacity={0.01} />
                                    </linearGradient>
                                    <linearGradient id="gSess" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={C.sessions} stopOpacity={0.16} />
                                        <stop offset="95%" stopColor={C.sessions} stopOpacity={0.01} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                                <XAxis dataKey="date"  tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                                <YAxis                 tick={AXIS_TICK} tickFormatter={formatNumber} width={44}     axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                <SpikeAnnotations spikes={spikes} />
                                {!hiddenSeries.has('DAU') && (
                                    <Area type="monotone" dataKey="dau" name="DAU" stroke={C.dau} fill="url(#gDau)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                                )}
                                {!hiddenSeries.has('Sessions') && (
                                    <Area type="monotone" dataKey="sessions" name="Sessions" stroke={C.sessions} fill="url(#gSess)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard
                    title="Purchase Volume & Revenue"
                    subtitle="Orders completed and GMV generated daily"
                    action={
                        <div className="flex gap-1">
                            {['Purchases', 'Revenue'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => toggleSeries(s)}
                                    className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                                        hiddenSeries.has(s)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    }
                >
                    {loading ? <InlineChartSkeleton height={240} /> : (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={ts} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                                <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left"  tick={AXIS_TICK} tickFormatter={formatNumber}                             width={44} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} width={46} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                {!hiddenSeries.has('Purchases') && (
                                    <Line yAxisId="left"  type="monotone" dataKey="purchases" name="Purchases" stroke={C.purchases} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                                )}
                                {!hiddenSeries.has('Revenue') && (
                                    <Line yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue"   stroke={C.revenue}   strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} strokeDasharray="5 3" isAnimationActive />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Row 2: Event Volume */}
            <ChartCard
                title="Event Volume — Views · Carts · Purchases"
                subtitle="Full funnel event volume trend over time"
                action={
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            {['Views', 'Carts', 'Purchases'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => toggleSeries(s)}
                                    className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                                        hiddenSeries.has(s)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <ToggleGroup
                            options={[{ label: 'Area', value: 'area' }, { label: 'Line', value: 'line' }]}
                            value={chartMode}
                            onChange={v => setChartMode(v as 'area' | 'line')}
                        />
                    </div>
                }
            >
                {loading ? <InlineChartSkeleton height={196} /> : (
                    <ResponsiveContainer width="100%" height={196}>
                        <AreaChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                            <defs>
                                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={C.views} stopOpacity={0.18} />
                                    <stop offset="95%" stopColor={C.views} stopOpacity={0.01} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                            <XAxis dataKey="date"  tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                            <YAxis                 tick={AXIS_TICK} tickFormatter={formatNumber} width={44}     axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            {!hiddenSeries.has('Views') && (
                                <Area type="monotone" dataKey="views" name="Views" stroke={C.views} fill="url(#gViews)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                            )}
                            {!hiddenSeries.has('Carts') && (
                                <Area type="monotone" dataKey="carts" name="Carts" stroke={C.carts} fill="none" strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                            )}
                            {!hiddenSeries.has('Purchases') && (
                                <Area type="monotone" dataKey="purchases" name="Purchases" stroke={C.purchases} fill="none" strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* DAU Drill-Down Modal */}
            <DrillDownModal
                open={drillOpen}
                onClose={() => setDrillOpen(false)}
                title="User Activity Breakdown"
                subtitle="Detailed view of user engagement metrics for this period"
                width="lg"
            >
                {kpis && (
                    <div className="space-y-5">
                        {/* KPI grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <ModalKpi label="Total Users"     value={formatNumber(kpis.total_users_approx)} sub="Unique visitors"   />
                            <ModalKpi label="Total Sessions"  value={formatNumber(kpis.total_sessions)}     sub="All sessions"     accent="#2563EB" />
                            <ModalKpi label="Sessions / User" value={(kpis.total_sessions / Math.max(kpis.total_users_approx, 1)).toFixed(1)} sub="Avg engagement"  accent="#14B8A6" />
                            <ModalKpi label="Total Purchases" value={formatNumber(kpis.total_purchases)}    sub="Completed orders" accent="#10B981" />
                            <ModalKpi label="Conversion Rate" value={formatPct(kpis.conversion_rate)}       sub="Session → Buy"    accent="#F59E0B" />
                            <ModalKpi label="Avg Order Value" value={formatCurrency(kpis.avg_order_value)}  sub="Per transaction"  accent="#8B5CF6" />
                        </div>

                        {/* Spike events */}
                        {spikes.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Detected Anomalies
                                </p>
                                <div className="space-y-1">
                                    {spikes.map(spike => (
                                        <ModalStatRow
                                            key={spike.date}
                                            label={`${spike.label} — ${fmtDate(spike.date)}`}
                                            value={formatNumber(spike.value)}
                                            sub={`${spike.z.toFixed(1)}σ above average`}
                                            color="#EF4444"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daily trend */}
                        {ts.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Period Trend
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-[10px] text-slate-400 font-semibold mb-1">DAU Trend</p>
                                        <p className={`text-[13px] font-bold ${dauTrend.dir === 'up' ? 'text-emerald-600' : dauTrend.dir === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {dauTrend.pct >= 0 ? '+' : ''}{dauTrend.pct.toFixed(1)}% {tLabel}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-[10px] text-slate-400 font-semibold mb-1">Sessions Trend</p>
                                        <p className={`text-[13px] font-bold ${sessTrend.dir === 'up' ? 'text-emerald-600' : sessTrend.dir === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {sessTrend.pct >= 0 ? '+' : ''}{sessTrend.pct.toFixed(1)}% {tLabel}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DrillDownModal>

        </div>{/* end main content */}

        {/* ── Right panel: insights + recommendations ────────────── */}
        <aside className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky space-y-4" style={{ top: 'calc(var(--header-height, 64px) + 20px)' }}>
                <KeyInsightsPanel
                    insights={insights}
                    loading={loading}
                />
                <ProductRecommendations
                    startDate={filters.startDate || undefined}
                    endDate={filters.endDate || undefined}
                />
            </div>
        </aside>

        </div>
    )
}
