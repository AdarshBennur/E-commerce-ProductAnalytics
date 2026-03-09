import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

const ACCENTS: Record<string, { color: string; bg: string }> = {
    indigo:  { color: '#4F46E5', bg: 'rgba(79,70,229,0.08)'   },
    blue:    { color: '#2563EB', bg: 'rgba(37,99,235,0.08)'   },
    teal:    { color: '#14B8A6', bg: 'rgba(20,184,166,0.10)'  },
    violet:  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.09)'  },
    green:   { color: '#10B981', bg: 'rgba(16,185,129,0.10)'  },
    success: { color: '#10B981', bg: 'rgba(16,185,129,0.10)'  },
    orange:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)'  },
    warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)'  },
    danger:  { color: '#EF4444', bg: 'rgba(239,68,68,0.09)'   },
    rose:    { color: '#EF4444', bg: 'rgba(239,68,68,0.09)'   },
    purple:  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.09)'  },
}

interface KpiCardProps {
    label:       string
    value:       string | number
    sub?:        string
    trend?:      number           // % change value
    trendLabel?: string           // e.g. "vs prev week"
    icon?:       ReactNode
    accent?:     keyof typeof ACCENTS
    onClick?:    () => void       // enables drill-down
    labelNode?:  ReactNode        // custom label (e.g. with MetricTooltip)
}

export function KpiCard({
    label,
    value,
    sub,
    trend,
    trendLabel,
    icon,
    accent = 'indigo',
    onClick,
    labelNode,
}: KpiCardProps) {
    const a = ACCENTS[accent] ?? ACCENTS.indigo

    return (
        <div
            className={clsx(
                'kpi-card card-hover animate-slide-up',
                onClick && 'cursor-pointer',
            )}
            style={{ '--kpi-accent': a.color, '--kpi-icon-bg': a.bg, '--kpi-icon-color': a.color } as React.CSSProperties}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
        >
            {/* Top row: label + icon */}
            <div className="flex items-start justify-between gap-3 mt-1">
                <div className="min-w-0">
                    {labelNode ?? <span className="metric-label">{label}</span>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onClick && (
                        <ExternalLink className="w-2.5 h-2.5 opacity-25 group-hover:opacity-60 transition-opacity" style={{ color: a.color }} />
                    )}
                    {icon && <div className="kpi-icon-wrap">{icon}</div>}
                </div>
            </div>

            {/* Value + trend chip */}
            <div className="flex items-end gap-2 mt-2">
                <span className="metric-value">{value}</span>
                {trend !== undefined && (
                    <span className={clsx('mb-1 flex-shrink-0',
                        trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-flat',
                    )}>
                        {trend > 0
                            ? <TrendingUp   className="w-2.5 h-2.5" />
                            : trend < 0
                                ? <TrendingDown className="w-2.5 h-2.5" />
                                : <Minus       className="w-2.5 h-2.5" />
                        }
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
            </div>

            {/* Sub-text */}
            {sub && <p className="metric-sub">{sub}</p>}

            {/* Trend label */}
            {trendLabel && trend !== undefined && (
                <p className="text-[9.5px] text-slate-400 mt-0.5">{trendLabel}</p>
            )}
        </div>
    )
}
