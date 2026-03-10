'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { Zap, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { fetchRecommendations } from '@/lib/api'
import type { RecommendationItem } from '@/lib/types'

const PRIORITY_CONFIG = {
    critical: { label: 'Critical', color: 'text-rose-600',   bg: 'bg-rose-50   ring-rose-200',   bar: 'bg-rose-500'   },
    high:     { label: 'High',     color: 'text-amber-600',  bg: 'bg-amber-50  ring-amber-200',  bar: 'bg-amber-400'  },
    medium:   { label: 'Medium',   color: 'text-indigo-600', bg: 'bg-indigo-50 ring-indigo-200', bar: 'bg-indigo-400' },
    low:      { label: 'Low',      color: 'text-slate-500',  bg: 'bg-slate-50  ring-slate-200',  bar: 'bg-slate-300'  },
}

const CATEGORY_LABEL: Record<string, string> = {
    funnel:      'Funnel',
    retention:   'Retention',
    revenue:     'Revenue',
    catalog:     'Catalog',
    engagement:  'Engagement',
}

interface RecommendationCardProps {
    rec: RecommendationItem
}

function RecommendationCard({ rec }: RecommendationCardProps) {
    const [expanded, setExpanded] = useState(false)
    const cfg = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.low

    return (
        <div className={clsx(
            'rounded-xl border border-slate-100 bg-white transition-all duration-200',
            'hover:border-indigo-100 hover:shadow-sm',
        )}>
            {/* Header row */}
            <button
                className="w-full flex items-start gap-3 p-3 text-left"
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
            >
                {/* Priority bar */}
                <div className={`w-1 flex-shrink-0 self-stretch rounded-full mt-0.5 ${cfg.bar}`} />

                {/* Icon */}
                <span className="text-[18px] leading-none flex-shrink-0">{rec.icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-slate-800 leading-snug">
                            {rec.title}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={clsx(
                                'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ring-1',
                                cfg.bg, cfg.color,
                            )}>
                                {cfg.label}
                            </span>
                            {expanded
                                ? <ChevronUp  className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            }
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {CATEGORY_LABEL[rec.category] ?? rec.category} · {rec.metric_ref}
                    </p>
                </div>
            </button>

            {/* Expanded explanation */}
            {expanded && (
                <div className="px-4 pb-3 pt-0 ml-4 animate-fade-in">
                    <div className="pl-5 border-l-2 border-slate-100">
                        <p className="text-[11.5px] text-slate-600 leading-relaxed">
                            {rec.explanation}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function RecSkeleton() {
    return (
        <div className="rounded-xl border border-slate-100 p-3 flex gap-3">
            <div className="w-1 self-stretch rounded-full skeleton" />
            <div className="skeleton w-5 h-5 rounded flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
            </div>
        </div>
    )
}

interface ProductRecommendationsProps {
    startDate?: string
    endDate?:   string
    className?: string
}

export function ProductRecommendations({ startDate, endDate, className }: ProductRecommendationsProps) {
    const [recs,    setRecs]    = useState<RecommendationItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetchRecommendations({ start_date: startDate, end_date: endDate })
            .then(data => setRecs(data.recommendations))
            .catch(() => setRecs([]))
            .finally(() => setLoading(false))
    }, [startDate, endDate])

    const critical = recs.filter(r => r.priority === 'critical').length
    const high     = recs.filter(r => r.priority === 'high').length

    return (
        <div className={clsx('card animate-fade-in', className)}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="section-title">Product Recommendations</h3>
                    {!loading && recs.length > 0 && (
                        <p className="text-[9.5px] text-slate-400 mt-0.5">
                            {critical > 0 && <span className="text-rose-500 font-bold">{critical} critical</span>}
                            {critical > 0 && high > 0 && ' · '}
                            {high > 0 && <span className="text-amber-500 font-semibold">{high} high priority</span>}
                        </p>
                    )}
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {recs.length} action{recs.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Recs list */}
            <div className="space-y-2">
                {loading
                    ? [1, 2, 3].map(i => <RecSkeleton key={i} />)
                    : recs.length === 0
                        ? (
                            <div className="flex items-center gap-2 p-3 text-slate-400 text-xs">
                                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                <span>No recommendations available for current data range.</span>
                            </div>
                        )
                        : recs.map(rec => <RecommendationCard key={rec.id} rec={rec} />)
                }
            </div>
        </div>
    )
}
