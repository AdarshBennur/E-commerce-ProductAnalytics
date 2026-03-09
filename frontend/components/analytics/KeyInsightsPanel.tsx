'use client'

import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus, Lightbulb, AlertCircle, CheckCircle, Info } from 'lucide-react'

export type InsightTrend  = 'up' | 'down' | 'neutral' | 'warning'
export type InsightBadge  = 'positive' | 'negative' | 'info' | 'warning' | 'highlight'

export interface Insight {
    text:       string
    metric?:    string          // e.g. "DAU", "CVR", "Revenue"
    trend?:     InsightTrend
    badge?:     string          // short label like "Peak", "Drop", "Key"
    badgeType?: InsightBadge
    highlight?: boolean         // shows as primary/prominent insight
}

interface KeyInsightsPanelProps {
    insights:   Insight[]
    title?:     string
    loading?:   boolean
    className?: string
}

const TREND_ICON = {
    up:      <TrendingUp  className="w-3.5 h-3.5" />,
    down:    <TrendingDown className="w-3.5 h-3.5" />,
    neutral: <Minus        className="w-3.5 h-3.5" />,
    warning: <AlertCircle  className="w-3.5 h-3.5" />,
}

const TREND_COLOR: Record<InsightTrend, string> = {
    up:      'text-emerald-600',
    down:    'text-rose-500',
    neutral: 'text-slate-400',
    warning: 'text-amber-500',
}

const BADGE_STYLE: Record<InsightBadge, string> = {
    positive:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    negative:  'bg-rose-50   text-rose-600   ring-1 ring-rose-200',
    info:      'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200',
    warning:   'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
    highlight: 'bg-indigo-600 text-white',
}

function InsightRow({ insight }: { insight: Insight }) {
    const trend = insight.trend ?? 'neutral'

    return (
        <div className={clsx(
            'insight-row flex items-start gap-3 p-3 rounded-xl transition-colors duration-150',
            insight.highlight ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50',
        )}>
            {/* Trend icon */}
            <div className={clsx(
                'mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center',
                trend === 'up'      ? 'bg-emerald-50 text-emerald-600' :
                trend === 'down'    ? 'bg-rose-50   text-rose-500'   :
                trend === 'warning' ? 'bg-amber-50  text-amber-600'  :
                                      'bg-slate-100 text-slate-400',
            )}>
                {TREND_ICON[trend]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={clsx(
                    'text-[12px] leading-relaxed',
                    insight.highlight ? 'font-semibold text-slate-800' : 'text-slate-700',
                )}>
                    {insight.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    {insight.metric && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {insight.metric}
                        </span>
                    )}
                    {insight.badge && (
                        <span className={clsx(
                            'text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                            BADGE_STYLE[insight.badgeType ?? 'info'],
                        )}>
                            {insight.badge}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

function InsightSkeleton() {
    return (
        <div className="flex items-start gap-3 p-3">
            <div className="w-6 h-6 rounded-lg skeleton flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
            </div>
        </div>
    )
}

export function KeyInsightsPanel({
    insights,
    title     = 'Key Insights',
    loading   = false,
    className,
}: KeyInsightsPanelProps) {
    return (
        <div className={clsx('card animate-fade-in', className)}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <h3 className="section-title">{title}</h3>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Auto
                </span>
            </div>

            {/* Insights list — height: auto, grows with content, no internal scroll */}
            {loading ? (
                <div className="space-y-1">
                    {[1, 2, 3].map(i => <InsightSkeleton key={i} />)}
                </div>
            ) : insights.length === 0 ? (
                <div className="flex items-center gap-2 p-3 text-slate-400 text-xs">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>Not enough data to generate insights.</span>
                </div>
            ) : (
                <div className="space-y-1">
                    {insights.map((insight, i) => (
                        <InsightRow key={i} insight={insight} />
                    ))}
                </div>
            )}
        </div>
    )
}
