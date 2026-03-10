'use client'

import { clsx } from 'clsx'
import { CheckCircle, Clock, PlayCircle, XCircle, Trophy } from 'lucide-react'

export type ExperimentStatus = 'running' | 'completed' | 'draft' | 'stopped'
export type Variant = {
    name:            string
    conversion:      number   // %
    users:           number
    isControl:       boolean
    isWinner?:       boolean
}

export interface Experiment {
    id:           string
    name:         string
    description:  string
    metric:       string
    status:       ExperimentStatus
    startDate:    string
    endDate?:     string
    confidence:   number   // 0–100
    lift:         number   // %
    variants:     Variant[]
    hypothesis:   string
}

const STATUS_CONFIG: Record<ExperimentStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    running:   { label: 'Running',   icon: PlayCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50 ring-emerald-200' },
    completed: { label: 'Completed', icon: CheckCircle,  color: 'text-indigo-600',  bg: 'bg-indigo-50 ring-indigo-200'  },
    draft:     { label: 'Draft',     icon: Clock,        color: 'text-slate-500',   bg: 'bg-slate-50 ring-slate-200'    },
    stopped:   { label: 'Stopped',   icon: XCircle,      color: 'text-rose-500',    bg: 'bg-rose-50 ring-rose-200'      },
}

interface ExperimentCardProps {
    experiment: Experiment
    onClick?:   () => void
}

export function ExperimentCard({ experiment, onClick }: ExperimentCardProps) {
    const { label, icon: StatusIcon, color, bg } = STATUS_CONFIG[experiment.status]
    const control   = experiment.variants.find(v => v.isControl)
    const challenger = experiment.variants.find(v => !v.isControl)
    const winner    = experiment.variants.find(v => v.isWinner)

    return (
        <div
            className={clsx(
                'card transition-all duration-200',
                onClick && 'cursor-pointer hover:shadow-hover hover:-translate-y-[1px]',
            )}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-[13px] font-bold text-slate-900 leading-snug">
                        {experiment.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {experiment.description}
                    </p>
                </div>
                <span className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ring-1 flex-shrink-0',
                    bg, color,
                )}>
                    <StatusIcon className="w-3 h-3" />
                    {label}
                </span>
            </div>

            {/* Metric & dates */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Metric</span>
                    <span className="text-[11px] font-semibold text-indigo-700">{experiment.metric}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                    {experiment.startDate}{experiment.endDate ? ` → ${experiment.endDate}` : ' → ongoing'}
                </span>
            </div>

            {/* Variants comparison */}
            <div className="space-y-2 mb-3">
                {experiment.variants.map(v => (
                    <div key={v.name} className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                            {v.isWinner && <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                            <span className={clsx(
                                'text-[11px] font-semibold truncate',
                                v.isWinner ? 'text-amber-600' : 'text-slate-700',
                            )}>
                                {v.name}
                            </span>
                            {v.isControl && (
                                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 flex-shrink-0">ctrl</span>
                            )}
                        </div>
                        <div className="flex-1 relative h-5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={clsx(
                                    'h-full rounded-full transition-all duration-500',
                                    v.isWinner ? 'bg-amber-400' : v.isControl ? 'bg-indigo-300' : 'bg-indigo-500',
                                )}
                                style={{ width: `${Math.min(v.conversion * 20, 100)}%` }}
                            />
                        </div>
                        <span className={clsx(
                            'text-[12px] font-bold w-12 text-right flex-shrink-0',
                            v.isWinner ? 'text-amber-600' : 'text-slate-700',
                        )}>
                            {v.conversion.toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>

            {/* Lift + Confidence */}
            <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100">
                <LiftMetric lift={experiment.lift} compact />
                <div className="flex items-center gap-1.5">
                    <div className="relative w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={clsx(
                                'h-full rounded-full',
                                experiment.confidence >= 95 ? 'bg-emerald-500'
                                : experiment.confidence >= 80 ? 'bg-amber-400'
                                : 'bg-slate-300',
                            )}
                            style={{ width: `${experiment.confidence}%` }}
                        />
                    </div>
                    <span className={clsx(
                        'text-[10px] font-bold',
                        experiment.confidence >= 95 ? 'text-emerald-600'
                        : experiment.confidence >= 80 ? 'text-amber-600'
                        : 'text-slate-400',
                    )}>
                        {experiment.confidence}% conf.
                    </span>
                </div>
                {winner && (
                    <span className="ml-auto text-[10px] font-bold text-amber-600 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> {winner.name} wins
                    </span>
                )}
            </div>
        </div>
    )
}

// ── LiftMetric ────────────────────────────────────────────────────────────────

interface LiftMetricProps {
    lift:    number
    compact?: boolean
}

export function LiftMetric({ lift, compact }: LiftMetricProps) {
    const positive = lift >= 0
    return (
        <div className={clsx(
            'flex items-center gap-1.5',
            !compact && 'px-3 py-2 rounded-xl border',
            !compact && (positive ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'),
        )}>
            <span className={clsx(
                compact ? 'text-[11px]' : 'text-[13px]',
                'font-bold',
                positive ? 'text-emerald-600' : 'text-rose-500',
            )}>
                {positive ? '+' : ''}{lift.toFixed(1)}%
            </span>
            <span className={clsx(
                compact ? 'text-[10px]' : 'text-[11px]',
                'font-medium',
                positive ? 'text-emerald-500' : 'text-rose-400',
            )}>
                lift
            </span>
        </div>
    )
}
