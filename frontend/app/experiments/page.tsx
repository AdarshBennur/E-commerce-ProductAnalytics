'use client'

import { useState } from 'react'
import { FlaskConical, TrendingUp, CheckCircle, PlayCircle, Lightbulb } from 'lucide-react'
import { ExperimentCard, LiftMetric, type Experiment } from '@/components/experiments/ExperimentCard'
import { VariantComparisonChart } from '@/components/experiments/VariantComparisonChart'
import { DrillDownModal, ModalKpi } from '@/components/analytics/DrillDownModal'

// ── Static experiment dataset (representative of real e-commerce A/B tests) ──

const EXPERIMENTS: Experiment[] = [
    {
        id:          'exp-001',
        name:        'Checkout Flow Simplification',
        description: 'Reducing checkout steps from 4 to 2 for faster purchase completion',
        metric:      'Purchase Conversion',
        status:      'completed',
        startDate:   '2019-10-01',
        endDate:     '2019-10-28',
        confidence:  97,
        lift:        46.9,
        hypothesis:  'A simplified 2-step checkout reduces friction and increases purchase rate.',
        variants: [
            { name: 'Control (4-step)',    conversion: 3.2, users: 18420, isControl: true,  isWinner: false },
            { name: 'Variant B (2-step)',  conversion: 4.7, users: 18650, isControl: false, isWinner: true  },
        ],
    },
    {
        id:          'exp-002',
        name:        'Product Page Image Layout',
        description: 'Image-first layout vs standard text-image split on product detail pages',
        metric:      'Add-to-Cart Rate',
        status:      'running',
        startDate:   '2019-11-01',
        confidence:  82,
        lift:        12.3,
        hypothesis:  'Visual-first layouts reduce cognitive load and increase intent.',
        variants: [
            { name: 'Control (Standard)',      conversion: 6.5, users: 12300, isControl: true,  isWinner: false },
            { name: 'Variant B (Image-first)', conversion: 7.3, users: 12180, isControl: false, isWinner: false },
        ],
    },
    {
        id:          'exp-003',
        name:        'Urgency Messaging on PDP',
        description: 'Adding stock count + "X people viewing" indicators on product pages',
        metric:      'Add-to-Cart Rate',
        status:      'completed',
        startDate:   '2019-09-15',
        endDate:     '2019-10-10',
        confidence:  94,
        lift:        8.6,
        hypothesis:  'Scarcity and social proof signals increase purchase urgency.',
        variants: [
            { name: 'Control (No urgency)',  conversion: 5.8, users: 9800,  isControl: true,  isWinner: false },
            { name: 'Variant B (Urgency)',   conversion: 6.3, users: 9950,  isControl: false, isWinner: true  },
        ],
    },
    {
        id:          'exp-004',
        name:        'Cart Recovery Email Timing',
        description: '1-hour vs 24-hour delay for cart abandonment recovery emails',
        metric:      'Cart Recovery Rate',
        status:      'completed',
        startDate:   '2019-10-05',
        endDate:     '2019-11-02',
        confidence:  99,
        lift:        31.4,
        hypothesis:  'Faster recovery email catches high-intent users before they convert elsewhere.',
        variants: [
            { name: 'Control (24h delay)',  conversion: 8.2,  users: 4200, isControl: true,  isWinner: false },
            { name: 'Variant B (1h delay)', conversion: 10.8, users: 4350, isControl: false, isWinner: true  },
        ],
    },
    {
        id:          'exp-005',
        name:        'Homepage Personalisation',
        description: 'Category-based personalised recommendations vs generic bestseller grid',
        metric:      'Click-Through Rate',
        status:      'running',
        startDate:   '2019-11-10',
        confidence:  61,
        lift:        5.2,
        hypothesis:  'Showing users products from their browsed categories increases CTR.',
        variants: [
            { name: 'Control (Bestsellers)',    conversion: 12.1, users: 7600, isControl: true,  isWinner: false },
            { name: 'Variant B (Personalised)', conversion: 12.7, users: 7540, isControl: false, isWinner: false },
        ],
    },
    {
        id:          'exp-006',
        name:        'Free Shipping Threshold Display',
        description: 'Progress bar showing remaining amount for free shipping eligibility',
        metric:      'Average Order Value',
        status:      'completed',
        startDate:   '2019-09-20',
        endDate:     '2019-10-18',
        confidence:  96,
        lift:        18.7,
        hypothesis:  'A visual AOV nudge motivates users to add more items to qualify.',
        variants: [
            { name: 'Control (No bar)',       conversion: 38.50, users: 11200, isControl: true,  isWinner: false },
            { name: 'Variant B (Progress)',   conversion: 45.70, users: 11380, isControl: false, isWinner: true  },
        ],
    },
]

// ── Aggregate stats ───────────────────────────────────────────────────────────

const totalExperiments  = EXPERIMENTS.length
const running           = EXPERIMENTS.filter(e => e.status === 'running').length
const completed         = EXPERIMENTS.filter(e => e.status === 'completed').length
const avgLift           = EXPERIMENTS.reduce((s, e) => s + e.lift, 0) / totalExperiments
const highConf          = EXPERIMENTS.filter(e => e.confidence >= 95).length

export default function ExperimentsPage() {
    const [selected,  setSelected]  = useState<Experiment | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const filtered = statusFilter === 'all'
        ? EXPERIMENTS
        : EXPERIMENTS.filter(e => e.status === statusFilter)

    return (
        <>
        <div className="flex gap-5 items-start animate-fade-in">

        {/* ── Main content ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Experiments', value: totalExperiments, icon: <FlaskConical className="w-4 h-4" />, color: '#4F46E5' },
                    { label: 'Currently Running', value: running,          icon: <PlayCircle   className="w-4 h-4" />, color: '#10B981' },
                    { label: 'Completed',         value: completed,        icon: <CheckCircle  className="w-4 h-4" />, color: '#2563EB' },
                    { label: 'Avg Lift (all)',     value: `+${avgLift.toFixed(1)}%`, icon: <TrendingUp className="w-4 h-4" />, color: '#F59E0B' },
                ].map(k => (
                    <div key={k.label} className="card" style={{ '--kpi-accent': k.color } as React.CSSProperties}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18`, color: k.color }}>
                                {k.icon}
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">{k.label}</p>
                        </div>
                        <p className="text-[22px] font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
                            {k.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-2">
                {['all', 'running', 'completed', 'stopped'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 capitalize ${
                            statusFilter === s
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {s === 'all' ? `All (${EXPERIMENTS.length})` : s}
                    </button>
                ))}
                <span className="ml-auto text-[11px] text-slate-400">
                    {filtered.length} experiment{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Experiment cards grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map(exp => (
                    <ExperimentCard
                        key={exp.id}
                        experiment={exp}
                        onClick={() => setSelected(exp)}
                    />
                ))}
            </div>

        </div>{/* end main content */}

        {/* ── Right insights panel ──────────────────────────────── */}
        <aside className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky" style={{ top: 'calc(var(--header-height, 64px) + 20px)' }}>
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <h3 className="section-title">Experiment Insights</h3>
                    </div>
                    <div className="space-y-2">
                        {[
                            { text: `${highConf} of ${totalExperiments} experiments reached 95%+ statistical confidence.`, badge: 'Sig', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { text: `Average observed lift across all experiments is +${avgLift.toFixed(1)}% — strong portfolio performance.`, badge: 'Lift', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { text: 'Checkout Flow test delivered the highest absolute lift (+46.9%) — priority shipping feature for all users.', badge: 'Top', color: 'text-amber-600', bg: 'bg-amber-50' },
                            { text: 'Cart recovery timing test shows 1h delay outperforms 24h by 31.4% — implement as default.', badge: 'Action', color: 'text-rose-600', bg: 'bg-rose-50' },
                            { text: `${running} experiments currently running — monitor confidence levels before drawing conclusions.`, badge: 'Live', color: 'text-blue-600', bg: 'bg-blue-50' },
                        ].map((insight, i) => (
                            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                                <span className={`flex-shrink-0 text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md mt-0.5 ${insight.bg} ${insight.color} ring-1 ring-current ring-opacity-20`}>
                                    {insight.badge}
                                </span>
                                <p className="text-[11.5px] text-slate-600 leading-relaxed">{insight.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>

        </div>

        {/* Experiment detail modal */}
        {selected && (
            <DrillDownModal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected.name}
                subtitle={selected.description}
                width="lg"
            >
                <div className="space-y-5">
                    {/* Top metrics */}
                    <div className="grid grid-cols-3 gap-3">
                        <ModalKpi
                            label="Lift"
                            value={`${selected.lift >= 0 ? '+' : ''}${selected.lift.toFixed(1)}%`}
                            sub="vs control"
                            accent={selected.lift >= 0 ? '#10B981' : '#EF4444'}
                        />
                        <ModalKpi
                            label="Confidence"
                            value={`${selected.confidence}%`}
                            sub={selected.confidence >= 95 ? 'Significant ✓' : 'Not yet sig.'}
                            accent={selected.confidence >= 95 ? '#4F46E5' : '#F59E0B'}
                        />
                        <ModalKpi
                            label="Status"
                            value={selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                            sub={selected.endDate ? `Ended ${selected.endDate}` : 'Ongoing'}
                            accent="#2563EB"
                        />
                    </div>

                    {/* Hypothesis */}
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">Hypothesis</p>
                        <p className="text-[12px] text-indigo-800 leading-relaxed">{selected.hypothesis}</p>
                    </div>

                    {/* Chart */}
                    <VariantComparisonChart experiment={selected} />

                    {/* Variant detail table */}
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Variant Details</p>
                        <div className="space-y-2">
                            {selected.variants.map(v => (
                                <div key={v.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-2">
                                        {v.isWinner && <span className="text-amber-500">🏆</span>}
                                        <span className="text-[12px] font-semibold text-slate-700">{v.name}</span>
                                        {v.isControl && <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Control</span>}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400">Users</p>
                                            <p className="text-[12px] font-bold text-slate-700">{v.users.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400">Conversion</p>
                                            <p className="text-[13px] font-bold text-indigo-600">{v.conversion.toFixed(2)}%</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Lift breakdown */}
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observed Lift</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Δ = ({selected.variants.find(v => !v.isControl)?.conversion.toFixed(2)}% −{' '}
                                {selected.variants.find(v => v.isControl)?.conversion.toFixed(2)}%) /{' '}
                                {selected.variants.find(v => v.isControl)?.conversion.toFixed(2)}%
                            </p>
                        </div>
                        <LiftMetric lift={selected.lift} />
                    </div>
                </div>
            </DrillDownModal>
        )}
        </>
    )
}
