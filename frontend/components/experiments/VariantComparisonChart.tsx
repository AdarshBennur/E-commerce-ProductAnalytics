'use client'

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { Experiment } from './ExperimentCard'

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8', fontWeight: 500 }

interface VariantComparisonChartProps {
    experiment: Experiment
}

export function VariantComparisonChart({ experiment }: VariantComparisonChartProps) {
    const data = experiment.variants.map(v => ({
        name:       v.name,
        conversion: v.conversion,
        users:      v.users,
        isControl:  v.isControl,
        isWinner:   v.isWinner ?? false,
    }))

    const controlVal = data.find(d => d.isControl)?.conversion ?? 0

    return (
        <div className="space-y-4">
            {/* Conversion rate bar chart */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Conversion Rate by Variant
                </p>
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                        <YAxis
                            tick={AXIS_TICK}
                            tickFormatter={v => `${v}%`}
                            axisLine={false} tickLine={false}
                            width={34}
                        />
                        <Tooltip
                            formatter={(v: number) => [`${v.toFixed(2)}%`, 'Conversion']}
                            contentStyle={{
                                fontSize: 11, borderRadius: 8,
                                border: '1px solid #E2E8F0',
                                background: '#FFFFFF',
                                boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
                            }}
                        />
                        {controlVal > 0 && (
                            <ReferenceLine
                                y={controlVal}
                                stroke="#94A3B8"
                                strokeDasharray="4 2"
                                label={{ value: 'Control', position: 'insideTopRight', fontSize: 9, fill: '#94A3B8' }}
                            />
                        )}
                        <Bar dataKey="conversion" radius={[6, 6, 0, 0]}>
                            {data.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.isWinner ? '#F59E0B' : entry.isControl ? '#A5B4FC' : '#4F46E5'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* User distribution */}
            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Sample Size by Variant
                </p>
                <div className="space-y-2">
                    {data.map(v => {
                        const total = data.reduce((s, d) => s + d.users, 0)
                        const pct   = total > 0 ? (v.users / total) * 100 : 0
                        return (
                            <div key={v.name} className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-slate-600 w-24 flex-shrink-0">
                                    {v.name}
                                </span>
                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-indigo-200 transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 w-20 text-right flex-shrink-0">
                                    {v.users.toLocaleString()} ({pct.toFixed(0)}%)
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
