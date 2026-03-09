'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFilters } from '@/lib/filter-context'
import { fetchFunnel } from '@/lib/api'
import type { FunnelData } from '@/lib/types'
import { KpiCard } from '@/components/ui/KpiCard'
import { KpiSkeleton, InlineChartSkeleton } from '@/components/ui/Skeleton'
import { ChartCard } from '@/components/ui/ChartCard'
import { ChartTooltip } from '@/components/ui/ChartTooltip'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/analytics/MetricTooltip'
import { DrillDownModal, ModalKpi, ModalStatRow } from '@/components/analytics/DrillDownModal'
import { fmtPct } from '@/lib/analytics'
import { formatNumber, formatPct, formatDate } from '@/lib/utils'
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { TrendingDown, Eye, ShoppingCart, CreditCard, ArrowRight } from 'lucide-react'

const C = { viewers: '#4F46E5', carted: '#2563EB', purchasers: '#10B981' }
const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

function buildInsights(data: FunnelData): Insight[] {
    const { funnel, top_categories } = data
    const insights: Insight[] = []

    // Largest drop-off
    const vtcDrop = 100 - funnel.view_to_cart_pct
    insights.push({
        text:      `The largest drop-off is between product view and add-to-cart — ${fmtPct(vtcDrop)} of viewers leave without engaging further.`,
        metric:    'View → Cart',
        trend:     'down',
        badge:     'Key Drop-off',
        badgeType: 'negative',
        highlight: true,
    })

    // Cart to purchase strength
    insights.push({
        text:      `Cart-to-purchase conversion is ${fmtPct(funnel.cart_to_purchase_pct)}, indicating ${funnel.cart_to_purchase_pct > 30 ? 'strong purchase intent — users who add to cart are very likely to buy' : 'moderate checkout completion — optimising the cart experience could lift revenue'}.`,
        metric:    'Cart → Purchase',
        trend:     funnel.cart_to_purchase_pct > 30 ? 'up' : 'neutral',
        badge:     funnel.cart_to_purchase_pct > 30 ? 'Strong CVR' : 'Opportunity',
        badgeType: funnel.cart_to_purchase_pct > 30 ? 'positive' : 'warning',
    })

    // Overall CVR
    insights.push({
        text:      `Only ${fmtPct(funnel.overall_conversion_pct)} of all viewers complete a purchase. Closing the top-of-funnel gap is the single biggest growth lever.`,
        metric:    'Overall CVR',
        trend:     'neutral',
    })

    // Top converting category
    if (top_categories.length > 0) {
        const best = top_categories.reduce((a, b) => a.conversion_rate > b.conversion_rate ? a : b)
        insights.push({
            text:      `${best.category_main} is the highest-converting category at ${fmtPct(best.conversion_rate)} CVR — a strong signal of category-product fit.`,
            metric:    'Top Category',
            trend:     'up',
            badge:     'Best CVR',
            badgeType: 'positive',
        })
    }

    return insights
}

function FunnelViz({ data }: { data: FunnelData['funnel'] }) {
    const stages = [
        { label: 'Product Views', value: data.viewers,    color: C.viewers,    icon: <Eye          className="w-3.5 h-3.5" /> },
        { label: 'Add to Cart',   value: data.carted,     color: C.carted,     icon: <ShoppingCart className="w-3.5 h-3.5" /> },
        { label: 'Purchase',      value: data.purchasers, color: C.purchasers, icon: <CreditCard   className="w-3.5 h-3.5" /> },
    ]
    const max = stages[0]?.value || 1

    return (
        <div className="space-y-4">
            {stages.map((stage, i) => {
                const pct     = (stage.value / max) * 100
                const prevPct = i > 0 ? (stage.value / stages[i - 1].value * 100).toFixed(1) : null
                return (
                    <div key={stage.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
                                    style={{ background: stage.color, boxShadow: `0 2px 8px ${stage.color}40` }}>
                                    {stage.icon}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{stage.label}</p>
                                    {prevPct && (
                                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                            <TrendingDown className="w-2.5 h-2.5" />{prevPct}% from prev
                                        </p>
                                    )}
                                </div>
                            </div>
                            <span className="text-sm font-extrabold text-slate-800 tabular-nums">{formatNumber(stage.value)}</span>
                        </div>
                        <div className="h-7 rounded-xl overflow-hidden" style={{ background: 'rgba(226,232,240,0.45)' }}>
                            <div
                                className="h-full rounded-xl flex items-center px-3 transition-all duration-700 ease-out"
                                style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25)` }}
                            >
                                {pct >= 20 && <span className="text-white text-[10px] font-bold">{pct.toFixed(1)}%</span>}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default function FunnelPage() {
    const { filters } = useFilters()
    const [data, setData]     = useState<FunnelData | null>(null)
    const [loading, setLoading] = useState(true)
    const [drillStage, setDrillStage] = useState<null | 'view-cart' | 'cart-purchase'>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setData(await fetchFunnel({
                start_date: filters.startDate || undefined,
                end_date:   filters.endDate   || undefined,
                category:   filters.category  || undefined,
                brand:      filters.brand     || undefined,
            }))
        } finally { setLoading(false) }
    }, [filters])

    useEffect(() => { load() }, [load])

    const funnel  = data?.funnel
    const ts      = data?.timeseries    ?? []
    const topCats = data?.top_categories ?? []
    const insights = useMemo(() => (data ? buildInsights(data) : []), [data])

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />) : <>
                    <KpiCard label="Unique Viewers" value={formatNumber(funnel?.viewers)}             sub="Saw at least 1 product" icon={<Eye          className="w-4 h-4" />} accent="blue"   />
                    <KpiCard label="Added to Cart"  value={formatNumber(funnel?.carted)}              sub="Proceeded to cart"      icon={<ShoppingCart className="w-4 h-4" />} accent="purple" />
                    <KpiCard label="Converted"      value={formatNumber(funnel?.purchasers)}          sub="Completed purchase"     icon={<CreditCard   className="w-4 h-4" />} accent="green"  />
                    <KpiCard
                        label="Overall CVR"
                        value={formatPct(funnel?.overall_conversion_pct)}
                        sub="View → Purchase"
                        icon={<TrendingDown className="w-4 h-4" />} accent="orange"
                        labelNode={<MetricTooltip {...METRIC_DEFINITIONS.conversionRate} />}
                    />
                </>}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <ChartCard title="Purchase Funnel" subtitle="Drop-off at each stage of the conversion path">
                    {loading || !funnel ? <InlineChartSkeleton height={240} /> : <>
                        <FunnelViz data={funnel} />
                        <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
                            {[
                                { id: 'view-cart' as const,      label: 'View → Cart',     val: funnel.view_to_cart_pct,     from: <Eye className="w-3 h-3" />,          to: <ShoppingCart className="w-3 h-3" />, color: '#4F46E5', bg: 'rgba(79,70,229,0.06)',  border: 'rgba(79,70,229,0.14)' },
                                { id: 'cart-purchase' as const,  label: 'Cart → Purchase', val: funnel.cart_to_purchase_pct, from: <ShoppingCart className="w-3 h-3" />, to: <CreditCard className="w-3 h-3" />,   color: '#10b981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.15)' },
                            ].map(item => (
                                <div
                                    key={item.label}
                                    className="rounded-2xl p-4 text-center cursor-pointer hover:scale-[1.02] transition-transform"
                                    style={{ background: item.bg, border: `1px solid ${item.border}` }}
                                    onClick={() => setDrillStage(item.id)}
                                    title="Click for stage breakdown"
                                >
                                    <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-60" style={{ color: item.color }}>
                                        {item.from}<ArrowRight className="w-2.5 h-2.5" />{item.to}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: item.color }}>{item.label}</p>
                                    <p className="text-2xl font-extrabold" style={{ color: item.color }}>{formatPct(item.val)}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">Click for breakdown →</p>
                                </div>
                            ))}
                        </div>
                    </>}
                </ChartCard>

                <ChartCard title="Daily Funnel Volume" subtitle="Day-by-day progression through purchase stages">
                    {loading ? <InlineChartSkeleton height={295} /> : (
                        <ResponsiveContainer width="100%" height={295}>
                            <LineChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                                <XAxis dataKey="date"  tick={AXIS_TICK} tickFormatter={formatDate} axisLine={false} tickLine={false} />
                                <YAxis                 tick={AXIS_TICK} tickFormatter={formatNumber} width={44}     axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                <Line type="monotone" dataKey="viewers"    name="Viewers"    stroke={C.viewers}    strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                                <Line type="monotone" dataKey="carted"     name="Carted"     stroke={C.carted}     strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                                <Line type="monotone" dataKey="purchasers" name="Purchasers" stroke={C.purchasers} strokeWidth={2}   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            <ChartCard title="Top Categories by Conversion Rate" subtitle="Which product categories convert users best">
                {loading ? <InlineChartSkeleton height={216} /> : (
                    <ResponsiveContainer width="100%" height={216}>
                        <BarChart data={topCats.slice(0, 12)} layout="vertical" margin={{ left: 88, right: 24, top: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" horizontal={false} />
                            <XAxis type="number" tick={AXIS_TICK} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="category_main" tick={{ ...AXIS_TICK, fill: '#64748b' }} width={88} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'CVR']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                            <Bar dataKey="conversion_rate" radius={[0, 6, 6, 0]}>
                                {topCats.slice(0, 12).map((_, i) => (
                                    <Cell key={i} fill={`hsl(${245 - i * 7}, 72%, ${63 - i * 1.5}%)`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* Stage Drill-Down Modal */}
            <DrillDownModal
                open={drillStage !== null}
                onClose={() => setDrillStage(null)}
                title={drillStage === 'view-cart' ? 'View → Cart Stage Analysis' : 'Cart → Purchase Stage Analysis'}
                subtitle="Detailed breakdown of this conversion stage"
            >
                {funnel && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                            {drillStage === 'view-cart' ? <>
                                <ModalKpi label="Viewers"        value={formatNumber(funnel.viewers)} sub="Entered funnel" />
                                <ModalKpi label="Added to Cart"  value={formatNumber(funnel.carted)}  sub="Proceeded" accent="#2563EB" />
                                <ModalKpi label="View→Cart CVR"  value={fmtPct(funnel.view_to_cart_pct)} sub="Stage conversion" accent="#4F46E5" />
                                <ModalKpi label="Drop-off"       value={formatNumber(funnel.viewers - funnel.carted)} sub="Lost at this stage" accent="#EF4444" />
                            </> : <>
                                <ModalKpi label="Added to Cart"  value={formatNumber(funnel.carted)}       sub="Entered checkout" />
                                <ModalKpi label="Purchased"      value={formatNumber(funnel.purchasers)}   sub="Completed"       accent="#10B981" />
                                <ModalKpi label="Cart→Buy CVR"   value={fmtPct(funnel.cart_to_purchase_pct)} sub="Stage conversion" accent="#4F46E5" />
                                <ModalKpi label="Abandoned"      value={formatNumber(funnel.carted - funnel.purchasers)} sub="Cart abandonment" accent="#EF4444" />
                            </>}
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Top Converting Categories</p>
                            {topCats.slice(0, 6).map((cat, i) => (
                                <ModalStatRow
                                    key={cat.category_main}
                                    rank={i + 1}
                                    label={cat.category_main}
                                    value={`${cat.conversion_rate.toFixed(1)}% CVR`}
                                    sub={`${formatNumber(cat.viewers)} viewers → ${formatNumber(cat.purchasers)} buyers`}
                                    color={`hsl(${245 - i * 15}, 70%, 58%)`}
                                />
                            ))}
                        </div>
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
                    maxHeight={520}
                />
            </div>
        </aside>

        </div>
    )
}
