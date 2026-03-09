'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFilters } from '@/lib/filter-context'
import { fetchCategories } from '@/lib/api'
import type { CategoryData } from '@/lib/types'
import { formatNumber, formatCurrency, formatPct } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts'
import { InlineChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { ChartCard, ToggleGroup } from '@/components/ui/ChartCard'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { Tag, TrendingUp } from 'lucide-react'

const PALETTE = ['#4F46E5', '#2563EB', '#14B8A6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

function buildInsights(data: CategoryData): Insight[] {
    const { top_categories: cats, top_brands: brands, category_conversion: catCvr } = data
    const insights: Insight[] = []

    if (cats.length === 0) return insights

    // Top revenue category
    const topCat = cats[0]
    const totalRev = cats.reduce((s, c) => s + c.revenue, 0)
    const topCatPct = totalRev > 0 ? (topCat.revenue / totalRev * 100).toFixed(0) : '0'
    insights.push({
        text:      `${topCat.category} is the top revenue category, generating ${formatCurrency(topCat.revenue)} — ${topCatPct}% of total GMV across all categories.`,
        metric:    'Top Category',
        trend:     'up',
        badge:     '#1 Revenue',
        badgeType: 'highlight',
        highlight: true,
    })

    // Best converting category
    if (catCvr.length > 0) {
        const bestCvr = catCvr.reduce((a, b) => a.conversion_rate > b.conversion_rate ? a : b)
        insights.push({
            text:      `${bestCvr.category} has the highest conversion rate at ${bestCvr.conversion_rate.toFixed(1)}% — meaning users who view these products are most likely to purchase.`,
            metric:    'Best CVR',
            trend:     'up',
            badge:     'Highest CVR',
            badgeType: 'positive',
        })
    }

    // Long tail
    if (cats.length >= 5) {
        const top3Rev = cats.slice(0, 3).reduce((s, c) => s + c.revenue, 0)
        const top3Pct = totalRev > 0 ? (top3Rev / totalRev * 100).toFixed(0) : '0'
        insights.push({
            text:      `The top 3 categories account for ${top3Pct}% of total revenue, indicating ${Number(top3Pct) > 70 ? 'high revenue concentration — diversifying category mix could reduce risk' : 'healthy revenue distribution across categories'}.`,
            metric:    'Concentration',
            trend:     Number(top3Pct) > 70 ? 'warning' : 'neutral',
            badge:     `Top3 = ${top3Pct}%`,
            badgeType: Number(top3Pct) > 70 ? 'warning' : 'info',
        })
    }

    // Top brand
    if (brands.length > 0) {
        const topBrand = brands[0]
        insights.push({
            text:      `${topBrand.brand} is the leading brand with ${formatCurrency(topBrand.revenue)} revenue and a ${topBrand.conversion_rate.toFixed(1)}% conversion rate.`,
            metric:    'Top Brand',
            trend:     'up',
        })
    }

    return insights
}

export default function CategoriesPage() {
    const { filters } = useFilters()
    const [data, setData]       = useState<CategoryData | null>(null)
    const [loading, setLoading] = useState(true)
    const [view, setView]       = useState<'categories' | 'brands'>('categories')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setData(await fetchCategories({
                start_date: filters.startDate || undefined,
                end_date:   filters.endDate   || undefined,
            }))
        } finally { setLoading(false) }
    }, [filters.startDate, filters.endDate])

    useEffect(() => { load() }, [load])

    const rawItems   = view === 'categories' ? data?.top_categories : data?.top_brands
    const nameKey    = view === 'categories' ? 'category' : 'brand'
    const items      = (rawItems ?? []).slice(0, 10)

    const revData = items.map((c: any) => ({
        name:    c[nameKey] ?? '—',
        revenue: c.revenue  ?? 0,
        orders:  c.purchases ?? 0,
        cvr:     c.conversion_rate ?? 0,
    }))

    const tableItems = (rawItems ?? []).slice(0, 20)
    const insights   = useMemo(() => (data ? buildInsights(data) : []), [data])

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            {/* Header with toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[15px] font-bold text-slate-900">
                        {view === 'categories' ? 'Category Performance' : 'Brand Performance'}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        Revenue, orders and conversion rate by {view === 'categories' ? 'category' : 'brand'}
                    </p>
                </div>
                <ToggleGroup
                    options={[{ label: 'Categories', value: 'categories' }, { label: 'Brands', value: 'brands' }]}
                    value={view}
                    onChange={v => setView(v as 'categories' | 'brands')}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <ChartCard title="Revenue by Segment" subtitle={`Top 10 ${view} by total revenue`}>
                    {loading ? <InlineChartSkeleton height={280} /> : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={revData} layout="vertical" margin={{ left: 0, right: 64, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" horizontal={false} />
                                <XAxis type="number" tick={AXIS_TICK} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: '#64748b', fontSize: 9.5 }} width={96} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                                <Bar dataKey="revenue" radius={[0, 8, 8, 0]} isAnimationActive>
                                    <LabelList dataKey="revenue" position="right" formatter={(v: any) => `$${(v/1000).toFixed(0)}K`} style={{ fontSize: 9.5, fontWeight: 700, fill: '#475569' }} />
                                    {revData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard title="Purchases by Segment" subtitle={`Top 10 ${view} by purchase volume`}>
                    {loading ? <InlineChartSkeleton height={280} /> : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={revData} layout="vertical" margin={{ left: 0, right: 56, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" horizontal={false} />
                                <XAxis type="number" tick={AXIS_TICK} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: '#64748b', fontSize: 9.5 }} width={96} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v: any) => [formatNumber(v), 'Purchases']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }} />
                                <Bar dataKey="orders" radius={[0, 8, 8, 0]} isAnimationActive>
                                    <LabelList dataKey="orders" position="right" formatter={formatNumber} style={{ fontSize: 9.5, fontWeight: 700, fill: '#475569' }} />
                                    {revData.map((_, i) => <Cell key={i} fill={`hsl(${160 + i * 12}, 60%, ${52 - i}%)`} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Detail table */}
            {loading ? <TableSkeleton rows={8} /> : (
                <div className="card overflow-x-auto animate-fade-in">
                    <div className="flex items-center gap-2 mb-5">
                        <h3 className="section-title">Detailed Breakdown</h3>
                        <span className="badge badge-neutral">{tableItems.length} {view}</span>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{view === 'categories' ? 'Category' : 'Brand'}</th>
                                <th className="text-right">Revenue</th>
                                <th className="text-right">Purchases</th>
                                <th className="text-right">Views</th>
                                <th className="text-right">CVR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableItems.map((c: any, i) => (
                                <tr key={c[nameKey] || i}>
                                    <td className="text-slate-400 font-mono text-[10px] w-8">{i + 1}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: `${PALETTE[i % PALETTE.length]}18` }}>
                                                {view === 'categories'
                                                    ? <Tag        className="w-3 h-3" style={{ color: PALETTE[i % PALETTE.length] }} />
                                                    : <TrendingUp className="w-3 h-3" style={{ color: PALETTE[i % PALETTE.length] }} />
                                                }
                                            </div>
                                            <span className="font-semibold text-slate-700 text-xs">{c[nameKey]}</span>
                                        </div>
                                    </td>
                                    <td className="text-right font-bold text-slate-800 tabular-nums">{formatCurrency(c.revenue)}</td>
                                    <td className="text-right tabular-nums text-slate-600">{formatNumber(c.purchases)}</td>
                                    <td className="text-right tabular-nums text-slate-600">{formatNumber(c.views)}</td>
                                    <td className="text-right">
                                        <span className="badge badge-blue">{formatPct(c.conversion_rate)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

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
