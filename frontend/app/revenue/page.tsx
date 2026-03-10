'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFilters } from '@/lib/filter-context'
import { fetchRevenue } from '@/lib/api'
import type { RevenueData } from '@/lib/types'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Cell,
} from 'recharts'
import { KpiSkeleton, InlineChartSkeleton } from '@/components/ui/Skeleton'
import { ChartCard, ToggleGroup } from '@/components/ui/ChartCard'
import { KpiCard } from '@/components/ui/KpiCard'
import { ChartTooltip } from '@/components/ui/ChartTooltip'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/analytics/MetricTooltip'
import { DrillDownModal, ModalKpi, ModalStatRow } from '@/components/analytics/DrillDownModal'
import { SpikeAnnotations, AnnotationLegend } from '@/components/analytics/ChartAnnotations'
import { computeTrend, detectSpikes, trendLabel, maxPoint, fmtDate } from '@/lib/analytics'
import { useInsights } from '@/lib/use-insights'
import { DollarSign, ShoppingCart, Package, Users } from 'lucide-react'

const C = { revenue: '#4F46E5', orders: '#10B981', aov: '#F59E0B' }
const PALETTE = ['#4F46E5', '#2563EB', '#14B8A6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

function buildInsights(data: RevenueData): Insight[] {
    const { kpis, timeseries: ts, by_category: cats } = data
    const insights: Insight[] = []

    // Revenue trend
    const revTrend = computeTrend(ts, 'revenue')
    if (ts.length >= 4) {
        insights.push({
            text:      `Revenue ${revTrend.dir === 'up' ? 'grew' : revTrend.dir === 'down' ? 'declined' : 'held steady'} ${Math.abs(revTrend.pct).toFixed(1)}% in the latter half of this period — ${revTrend.dir === 'up' ? 'a positive growth trajectory' : revTrend.dir === 'down' ? 'worth investigating for seasonal or product factors' : 'consistent performance'}.`,
            metric:    'Revenue Trend',
            trend:     revTrend.dir,
            badge:     `${revTrend.pct >= 0 ? '+' : ''}${revTrend.pct.toFixed(1)}%`,
            badgeType: revTrend.dir === 'up' ? 'positive' : revTrend.dir === 'down' ? 'negative' : 'info',
            highlight: true,
        })
    }

    // Peak revenue day
    const peak = maxPoint(ts, 'revenue')
    if (peak?.revenue) {
        insights.push({
            text:      `Peak revenue day was ${fmtDate(String(peak.date ?? ''))}, generating ${formatCurrency(Number(peak.revenue))} — the single highest-earning day in this period.`,
            metric:    'Peak Day',
            trend:     'up',
            badge:     'Peak Revenue',
            badgeType: 'highlight',
        })
    }

    // AOV signal
    if (kpis.avg_order_value > 0) {
        insights.push({
            text:      `Average order value is ${formatCurrency(kpis.avg_order_value)} across ${formatNumber(kpis.total_orders)} orders. ${kpis.avg_order_value > 100 ? 'High AOV suggests users are buying premium or multiple items per transaction.' : 'Opportunities exist to increase AOV through upsell and bundle strategies.'}`,
            metric:    'AOV',
            trend:     kpis.avg_order_value > 100 ? 'up' : 'neutral',
        })
    }

    // Category concentration
    if (cats.length > 0) {
        const topCat   = cats[0]
        const totalRev = cats.reduce((s, c) => s + c.revenue, 0)
        const topPct   = totalRev > 0 ? (topCat.revenue / totalRev * 100).toFixed(0) : '0'
        insights.push({
            text:      `${topCat.category} drives ${topPct}% of total category revenue. ${Number(topPct) > 50 ? 'Strong revenue concentration in one category creates both opportunity and risk.' : 'Revenue is reasonably distributed across categories.'}`,
            metric:    'Top Category',
            trend:     'neutral',
        })
    }

    return insights
}

export default function RevenuePage() {
    const { filters } = useFilters()
    const [data, setData]       = useState<RevenueData | null>(null)
    const [loading, setLoading] = useState(true)
    const [gran, setGran]       = useState<'daily' | 'weekly'>('daily')
    const [revDrillOpen, setRevDrillOpen] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setData(await fetchRevenue({
                start_date:  filters.startDate || undefined,
                end_date:    filters.endDate   || undefined,
                granularity: gran,
            }))
        } finally { setLoading(false) }
    }, [filters.startDate, filters.endDate, gran])

    useEffect(() => { load() }, [load])

    const kpis    = data?.kpis
    const ts      = data?.timeseries  ?? []
    const cats    = data?.by_category ?? []
    const staticInsights = useMemo(() => (data ? buildInsights(data) : []), [data])
    const { insights }   = useInsights({
        startDate:       filters.startDate || undefined,
        endDate:         filters.endDate   || undefined,
        segment:         filters.segment   || undefined,
        staticInsights,
    })
    const revSpikes = useMemo(() => detectSpikes(ts, 'revenue'), [ts])
    const revTrend  = useMemo(() => computeTrend(ts, 'revenue'),  [ts])
    const ordTrend  = useMemo(() => computeTrend(ts, 'orders'),   [ts])
    const tLabel    = trendLabel(ts.length)

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />) : <>
                    <KpiCard
                        label="Total Revenue" value={formatCurrency(kpis?.total_revenue)}
                        sub="Total GMV"
                        trend={revTrend.pct} trendLabel={tLabel}
                        icon={<DollarSign className="w-4 h-4" />} accent="blue"
                        onClick={() => setRevDrillOpen(true)}
                        labelNode={<MetricTooltip {...METRIC_DEFINITIONS.gmv} />}
                    />
                    <KpiCard
                        label="Total Orders" value={formatNumber(kpis?.total_orders)}
                        sub="Completed purchases"
                        trend={ordTrend.pct} trendLabel={tLabel}
                        icon={<ShoppingCart className="w-4 h-4" />} accent="green"
                    />
                    <KpiCard
                        label="Avg Order Value" value={formatCurrency(kpis?.avg_order_value)}
                        sub="Revenue per order"
                        icon={<Package className="w-4 h-4" />} accent="orange"
                        labelNode={<MetricTooltip {...METRIC_DEFINITIONS.aov} />}
                    />
                    <KpiCard label="Unique Buyers" value={formatNumber(kpis?.unique_buyers)} sub="Distinct purchasers" icon={<Users className="w-4 h-4" />} accent="purple" />
                </>}
            </div>

            {/* Revenue over time */}
            <ChartCard
                title="Revenue & Orders over Time"
                subtitle="GMV and order count by day or week"
                action={
                    <div className="flex items-center gap-2">
                        <AnnotationLegend count={revSpikes.length} />
                        <ToggleGroup
                            options={[{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }]}
                            value={gran}
                            onChange={v => setGran(v as 'daily' | 'weekly')}
                        />
                    </div>
                }
            >
                {loading ? <InlineChartSkeleton height={256} /> : (
                    <ResponsiveContainer width="100%" height={256}>
                        <AreaChart data={ts} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                            <defs>
                                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.22} />
                                    <stop offset="95%" stopColor={C.revenue} stopOpacity={0.01} />
                                </linearGradient>
                                <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={C.orders} stopOpacity={0.16} />
                                    <stop offset="95%" stopColor={C.orders} stopOpacity={0.01} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                            <XAxis dataKey="date"  tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left"  tick={AXIS_TICK} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} width={48} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={formatNumber} width={44} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip valueFormats={{ revenue: 'currency', orders: 'number' }} />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                            <SpikeAnnotations spikes={revSpikes} color="#F59E0B" />
                            <Area yAxisId="left"  type="monotone" dataKey="revenue" name="Revenue" stroke={C.revenue} fill="url(#gRev)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                            <Area yAxisId="right" type="monotone" dataKey="orders"  name="Orders"  stroke={C.orders}  fill="url(#gOrd)" strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* AOV + by_category */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <ChartCard title="Average Order Value Trend" subtitle="AOV fluctuation over time">
                    {loading ? <InlineChartSkeleton height={220} /> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                                <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_TICK} tickFormatter={v => `$${Number(v).toFixed(0)}`} width={44} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip valueFormats={{ aov: 'currency' }} />} />
                                <Line type="monotone" dataKey="aov" name="AOV" stroke={C.aov} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard title="Revenue by Category" subtitle="GMV contribution from top categories">
                    {loading ? <InlineChartSkeleton height={220} /> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={cats.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 56, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" horizontal={false} />
                                <XAxis type="number" tick={AXIS_TICK} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="category" tick={{ ...AXIS_TICK, fill: '#64748b', fontSize: 9.5 }} width={92} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                                <Bar dataKey="revenue" radius={[0, 8, 8, 0]} isAnimationActive>
                                    <LabelList dataKey="revenue" position="right" formatter={(v: any) => `$${(v/1000).toFixed(0)}K`} style={{ fontSize: 9.5, fontWeight: 700, fill: '#475569' }} />
                                    {cats.slice(0, 8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Revenue Drill-Down Modal */}
            <DrillDownModal
                open={revDrillOpen}
                onClose={() => setRevDrillOpen(false)}
                title="Revenue Breakdown"
                subtitle="Detailed view of revenue performance and category contribution"
                width="lg"
            >
                {kpis && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <ModalKpi label="Total Revenue"   value={formatCurrency(kpis.total_revenue)}   sub="Total GMV"            />
                            <ModalKpi label="Total Orders"    value={formatNumber(kpis.total_orders)}       sub="Completed"            accent="#10B981" />
                            <ModalKpi label="Avg Order Value" value={formatCurrency(kpis.avg_order_value)}  sub="Per transaction"      accent="#F59E0B" />
                            <ModalKpi label="Unique Buyers"   value={formatNumber(kpis.unique_buyers)}      sub="Distinct purchasers"  accent="#8B5CF6" />
                        </div>

                        {/* Revenue spikes */}
                        {revSpikes.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Revenue Anomalies</p>
                                {revSpikes.map(spike => (
                                    <ModalStatRow
                                        key={spike.date}
                                        label={`${spike.label} — ${fmtDate(spike.date)}`}
                                        value={formatCurrency(spike.value)}
                                        sub={`${spike.z.toFixed(1)}σ above average daily revenue`}
                                        color="#F59E0B"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Category breakdown */}
                        {cats.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Revenue by Category</p>
                                {cats.slice(0, 8).map((cat, i) => {
                                    const totalRev = cats.reduce((s, c) => s + c.revenue, 0)
                                    const pct = totalRev > 0 ? (cat.revenue / totalRev * 100).toFixed(1) : '0'
                                    return (
                                        <ModalStatRow
                                            key={cat.category}
                                            rank={i + 1}
                                            label={cat.category}
                                            value={formatCurrency(cat.revenue)}
                                            sub={`${pct}% of total · ${formatNumber(cat.orders)} orders`}
                                            color={PALETTE[i % PALETTE.length]}
                                        />
                                    )
                                })}
                            </div>
                        )}

                        {/* Period trends */}
                        {ts.length >= 4 && (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Period Comparison</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-[10px] text-slate-400 font-semibold mb-1">Revenue Trend</p>
                                        <p className={`text-[13px] font-bold ${revTrend.dir === 'up' ? 'text-emerald-600' : revTrend.dir === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {revTrend.pct >= 0 ? '+' : ''}{revTrend.pct.toFixed(1)}% {tLabel}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-[10px] text-slate-400 font-semibold mb-1">Orders Trend</p>
                                        <p className={`text-[13px] font-bold ${ordTrend.dir === 'up' ? 'text-emerald-600' : ordTrend.dir === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                                            {ordTrend.pct >= 0 ? '+' : ''}{ordTrend.pct.toFixed(1)}% {tLabel}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DrillDownModal>

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
