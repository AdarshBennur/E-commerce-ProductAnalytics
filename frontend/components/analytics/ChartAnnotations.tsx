'use client'

import { ReferenceLine } from 'recharts'
import type { Spike } from '@/lib/analytics'

interface AnnotationsProps {
    spikes:   Spike[]
    color?:   string
    maxShow?: number
}

/**
 * Renders Recharts ReferenceLine annotations for detected spikes.
 * Must be used INSIDE a Recharts chart component.
 */
export function SpikeAnnotations({ spikes, color = '#EF4444', maxShow = 3 }: AnnotationsProps) {
    return (
        <>
            {spikes.slice(0, maxShow).map((spike, i) => (
                <ReferenceLine
                    key={`spike-${i}`}
                    x={spike.date}
                    stroke={color}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    label={{
                        value: spike.label,
                        position: 'insideTopRight',
                        fontSize: 8,
                        fontWeight: 600,
                        fill: color,
                        offset: 4,
                    }}
                />
            ))}
        </>
    )
}

// ── Annotation legend chip ────────────────────────────────────────────────

interface AnnotationLegendProps {
    count:  number
    color?: string
}

export function AnnotationLegend({ count, color = '#EF4444' }: AnnotationLegendProps) {
    if (count === 0) return null
    return (
        <div className="flex items-center gap-1.5">
            <svg width="14" height="10" viewBox="0 0 14 10">
                <line x1="0" y1="5" x2="14" y2="5" stroke={color} strokeWidth={1.5} strokeDasharray="3 2" />
            </svg>
            <span className="text-[9.5px] font-semibold" style={{ color }}>
                {count} spike{count > 1 ? 's' : ''} detected
            </span>
        </div>
    )
}
