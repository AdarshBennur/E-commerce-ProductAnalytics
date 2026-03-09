'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface MetricTooltipProps {
    label:       string             // The metric label text
    description: string             // What this metric means
    formula?:    string             // Optional: how it's calculated
    children?:   React.ReactNode    // Custom trigger (defaults to label + ? icon)
    placement?:  'top' | 'bottom'
}

export function MetricTooltip({
    label,
    description,
    formula,
    children,
    placement = 'top',
}: MetricTooltipProps) {
    const [visible, setVisible] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        if (!visible) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setVisible(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [visible])

    return (
        <div
            ref={ref}
            className="relative inline-flex items-center gap-1 cursor-default"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {/* Trigger */}
            {children ?? (
                <>
                    <span className="metric-label">{label}</span>
                    <HelpCircle className="w-3 h-3 text-slate-300 hover:text-indigo-400 transition-colors flex-shrink-0" />
                </>
            )}

            {/* Tooltip popup */}
            {visible && (
                <div className={clsx(
                    'absolute z-50 w-56 p-3 rounded-xl pointer-events-none',
                    'bg-slate-900 text-white shadow-lg border border-slate-800',
                    'animate-scale-in',
                    placement === 'top'
                        ? 'bottom-full mb-2 left-0'
                        : 'top-full mt-2 left-0',
                )}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                        {label}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-200">{description}</p>
                    {formula && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                            <p className="text-[9.5px] text-slate-400 font-mono">{formula}</p>
                        </div>
                    )}
                    {/* Arrow */}
                    <div className={clsx(
                        'absolute w-2 h-2 bg-slate-900 border border-slate-800 rotate-45',
                        placement === 'top'
                            ? 'top-full -translate-y-1/2 left-4 border-t-0 border-l-0'
                            : 'bottom-full translate-y-1/2 left-4 border-b-0 border-r-0',
                    )} />
                </div>
            )}
        </div>
    )
}

// ── Predefined metric definitions ─────────────────────────────────────────

export const METRIC_DEFINITIONS = {
    dau: {
        label:       'DAU',
        description: 'Number of unique users who performed at least one event on the platform in a given day.',
        formula:     'COUNT(DISTINCT user_id) per day',
    },
    sessions: {
        label:       'Sessions',
        description: 'A session is a period of continuous user activity. One user can have multiple sessions per day.',
        formula:     'COUNT(session_id)',
    },
    conversionRate: {
        label:       'Conversion Rate',
        description: 'Percentage of unique viewers who completed at least one purchase in the period.',
        formula:     'purchasers / viewers × 100',
    },
    aov: {
        label:       'Avg Order Value',
        description: 'Average revenue generated per completed purchase transaction.',
        formula:     'total_revenue / total_orders',
    },
    retention: {
        label:       'Retention',
        description: 'Percentage of users from a given cohort who return to the platform in a subsequent week.',
        formula:     'retained_users / cohort_size × 100',
    },
    sessionCvr: {
        label:       'Session CVR',
        description: 'Percentage of sessions that resulted in at least one purchase event.',
        formula:     'purchase_sessions / total_sessions × 100',
    },
    viewToCart: {
        label:       'View → Cart',
        description: 'Percentage of users who viewed a product and then added it to their cart.',
        formula:     'carted_users / viewer_users × 100',
    },
    cartToPurchase: {
        label:       'Cart → Purchase',
        description: 'Percentage of users who added a product to cart and then completed a purchase.',
        formula:     'purchasers / carted_users × 100',
    },
    gmv: {
        label:       'GMV',
        description: 'Gross Merchandise Value — total revenue from all completed purchase transactions.',
        formula:     'SUM(price) for all purchase events',
    },
} as const
