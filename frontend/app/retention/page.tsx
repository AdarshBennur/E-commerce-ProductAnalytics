'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchRetention } from '@/lib/api'
import type { RetentionData } from '@/lib/types'
import { formatWeek, formatPct } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { InlineChartSkeleton, KpiSkeleton } from '@/components/ui/Skeleton'
import { ChartCard } from '@/components/ui/ChartCard'
import { KpiCard } from '@/components/ui/KpiCard'
import { KeyInsightsPanel, type Insight } from '@/components/analytics/KeyInsightsPanel'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/analytics/MetricTooltip'
import { Users } from 'lucide-react'
import { useInsights } from '@/lib/use-insights'
import { useFilters } from '@/lib/filter-context'

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

function heatBg(pct: number) {
    if (pct >= 80) return { bg: '#3730A3', fg: '#fff' }
    if (pct >= 60) return { bg: '#4338CA', fg: '#fff' }
    if (pct >= 40) return { bg: '#4F46E5', fg: '#fff' }
    if (pct >= 25) return { bg: '#6366F1', fg: '#fff' }
    if (pct >= 10) return { bg: '#A5B4FC', fg: '#3730A3' }
    if (pct >   0) return { bg: '#EEF2FF', fg: '#4338CA' }
    return { bg: 'rgba(241,245,249,0.5)', fg: '#cbd5e1' }
}

function buildInsights(data: RetentionData): Insight[] {
    const wa = data.week_averages
    const insights: Insight[] = []

    const w1 = wa.find(w => w.week_number === 1)?.avg_retention_pct
    const w4 = wa.find(w => w.week_number === 4)?.avg_retention_pct
    const w8 = wa.find(w => w.week_number === 8)?.avg_retention_pct

    if (w1 != null) {
        insights.push({
            text:      `Week 1 retention averages ${w1.toFixed(1)}% — ${w1 >= 25 ? 'strong early engagement, users are returning after their first experience' : 'moderate early engagement, indicating an opportunity to improve the onboarding experience'}.`,
            metric:    'W1 Retention',
            trend:     w1 >= 25 ? 'up' : 'neutral',
            badge:     w1 >= 25 ? 'Strong' : 'Moderate',
            badgeType: w1 >= 25 ? 'positive' : 'warning',
            highlight: true,
        })
    }

    if (w1 != null && w4 != null) {
        const drop = w1 - w4
        insights.push({
            text:      `Retention drops ${drop.toFixed(1)}pp between week 1 and week 4, from ${w1.toFixed(1)}% to ${w4.toFixed(1)}%. ${drop > 10 ? 'The sharp mid-funnel decline suggests a re-engagement opportunity around week 2–3.' : 'The gradual decline is typical — focus on week 2 nudges to flatten the curve.'}`,
            metric:    'W1→W4 Drop',
            trend:     drop > 10 ? 'down' : 'neutral',
            badge:     `–${drop.toFixed(1)}pp`,
            badgeType: drop > 15 ? 'negative' : 'warning',
        })
    }

    const cohortCount = new Set(data.cohort_matrix.map(r => r.cohort_week)).size
    if (cohortCount > 0) {
        insights.push({
            text:      `${cohortCount} weekly cohorts analysed. Week 0 captures new users acquired in that week; subsequent weeks measure their return rate.`,
            metric:    'Cohorts',
            trend:     'neutral',
        })
    }

    if (w8 != null) {
        insights.push({
            text:      `8-week retention is ${w8.toFixed(1)}%. ${w8 > 5 ? 'Users retained at 8 weeks represent your most loyal segment.' : 'Very few users remain after 8 weeks — investing in long-term engagement programs could help.'}`,
            metric:    'W8 Retention',
            trend:     w8 > 5 ? 'up' : 'down',
        })
    }

    return insights
}

export default function RetentionPage() {
    const { filters }           = useFilters()
    const [data, setData]       = useState<RetentionData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRetention().then(setData).finally(() => setLoading(false))
    }, [])

    const cohorts  = Array.from(new Set((data?.cohort_matrix ?? []).map(r => r.cohort_week))).sort()
    const maxWeeks = 9
    const cellMap  = new Map<string, number>()
    data?.cohort_matrix?.forEach(r => cellMap.set(`${r.cohort_week}:${r.week_number}`, r.retention_pct))
    const sizeMap  = new Map<string, number>()
    data?.cohort_matrix?.forEach(r => { if (!sizeMap.has(r.cohort_week)) sizeMap.set(r.cohort_week, r.cohort_size) })

    const weekAvgs = data?.week_averages ?? []
    const w1 = weekAvgs.find(w => w.week_number === 1)?.avg_retention_pct
    const w4 = weekAvgs.find(w => w.week_number === 4)?.avg_retention_pct
    const w8 = weekAvgs.find(w => w.week_number === 8)?.avg_retention_pct

    const staticInsights = useMemo(() => (data ? buildInsights(data) : []), [data])
    const { insights }   = useInsights({
        segment:        filters.segment || undefined,
        staticInsights,
    })

    return (
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            {/* Retention KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {loading ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />) : <>
                    <KpiCard
                        label="Week 1 Retention" value={w1 != null ? formatPct(w1) : '—'}
                        sub="Users returning after 1 week"
                        icon={<Users className="w-4 h-4" />} accent="blue"
                        labelNode={<MetricTooltip {...METRIC_DEFINITIONS.retention} label="W1 Retention" />}
                    />
                    <KpiCard label="Week 4 Retention" value={w4 != null ? formatPct(w4) : '—'} sub="Active one month later"  icon={<Users className="w-4 h-4" />} accent="purple" />
                    <KpiCard label="Week 8 Retention" value={w8 != null ? formatPct(w8) : '—'} sub="Active two months later" icon={<Users className="w-4 h-4" />} accent="green"  />
                </>}
            </div>

            {/* Cohort Heatmap */}
            <div className="card overflow-x-auto animate-fade-in">
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                        <h3 className="section-title">Cohort Retention Heatmap</h3>
                        <p className="section-sub">% of users returning each week after acquisition</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Low</span>
                        {[0, 10, 25, 50, 75, 95].map(v => {
                            const { bg } = heatBg(v)
                            return <div key={v} className="w-5 h-5 rounded-md" style={{ background: bg }} title={`${v}%`} />
                        })}
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">High</span>
                    </div>
                </div>

                {loading ? <InlineChartSkeleton height={240} /> : (
                    <div className="min-w-[700px]">
                        <table className="text-xs w-full">
                            <thead>
                                <tr>
                                    <th className="text-left font-bold text-slate-400 py-2 pr-3 w-24 text-[9px] uppercase tracking-widest">Cohort</th>
                                    <th className="font-bold text-slate-400 py-2 px-2 text-center text-[9px] uppercase tracking-widest w-16">Size</th>
                                    {Array.from({ length: maxWeeks }).map((_, w) => (
                                        <th key={w} className="font-bold text-slate-400 py-2 px-1 text-center text-[9px] uppercase tracking-widest">
                                            {w === 0 ? 'Wk0' : `+${w}w`}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cohorts.map(cohort => (
                                    <tr key={cohort} className="group">
                                        <td className="py-1 pr-3 font-semibold text-slate-600">{formatWeek(cohort)}</td>
                                        <td className="py-1 px-2 text-center text-slate-500 tabular-nums font-medium">{(sizeMap.get(cohort) ?? 0).toLocaleString()}</td>
                                        {Array.from({ length: maxWeeks }).map((_, w) => {
                                            const val       = cellMap.get(`${cohort}:${w}`)
                                            const { bg, fg} = heatBg(val ?? 0)
                                            return (
                                                <td key={w} className="py-0.5 px-0.5">
                                                    <div
                                                        className="rounded-lg text-center py-1.5 tabular-nums font-bold text-[10px] transition-all duration-150 cursor-default hover:scale-105"
                                                        style={{ background: bg, color: fg, minWidth: '36px', boxShadow: val ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : 'none' }}
                                                        title={val != null ? `${val.toFixed(1)}%` : 'No data'}
                                                    >
                                                        {val != null ? `${val.toFixed(0)}%` : '—'}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Avg Retention */}
            <ChartCard title="Average Retention by Week" subtitle="Avg % of cohort returning each week across all cohorts">
                {loading ? <InlineChartSkeleton height={216} /> : (
                    <ResponsiveContainer width="100%" height={216}>
                        <BarChart data={weekAvgs} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.55)" vertical={false} />
                            <XAxis dataKey="week_number" tick={AXIS_TICK} tickFormatter={w => w === 0 ? 'Wk0' : `+${w}w`} axisLine={false} tickLine={false} />
                            <YAxis tick={AXIS_TICK} tickFormatter={v => `${v}%`} domain={[0, 100]} width={36} axisLine={false} tickLine={false} />
                            <Tooltip
                                formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Avg Retention']}
                                labelFormatter={w => w === 0 ? 'Week 0 (cohort week)' : `Week +${w}`}
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFFFFF', boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
                            />
                            <Bar dataKey="avg_retention_pct" radius={[6, 6, 0, 0]}>
                                {weekAvgs.map((_, i) => (
                                    <Cell key={i} fill={`hsl(245, ${75 - i * 5}%, ${60 + i * 2}%)`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

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
