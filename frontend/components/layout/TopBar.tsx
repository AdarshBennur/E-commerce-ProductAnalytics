'use client'

import { usePathname } from 'next/navigation'
import { useFilters } from '@/lib/filter-context'
import { useSidebar } from '@/lib/sidebar-context'
import { SlidersHorizontal, X, Menu, CalendarDays, ChevronDown, Users } from 'lucide-react'
import type { FiltersData } from '@/lib/types'

const PAGE_META: Record<string, { title: string; sub: string }> = {
    '/overview':     { title: 'Executive Overview',           sub: 'Platform-wide performance at a glance' },
    '/funnel':       { title: 'Funnel Analysis',              sub: 'User conversion through purchase stages' },
    '/retention':    { title: 'Retention & Cohorts',          sub: 'Weekly cohort retention heatmap' },
    '/behavior':     { title: 'User Behavior',                sub: 'Session patterns and engagement signals' },
    '/categories':   { title: 'Category & Brand Performance', sub: 'Revenue, orders and conversion by segment' },
    '/revenue':      { title: 'Revenue Analytics',            sub: 'GMV, orders and average order value' },
    '/experiments':  { title: 'Experimentation',              sub: 'A/B test results and variant performance' },
}

const SEGMENT_OPTIONS = [
    { value: '',                 label: 'All Users'          },
    { value: 'high_value_buyers',label: 'High-Value Buyers'  },
    { value: 'returning_users',  label: 'Returning Users'    },
    { value: 'new_users',        label: 'New Users'          },
    { value: 'browse_only',      label: 'Browse-Only'        },
    { value: 'one_time_buyers',  label: 'One-Time Buyers'    },
]

interface TopBarProps { filtersData: FiltersData }

export function TopBar({ filtersData }: TopBarProps) {
    const pathname = usePathname()
    const { filters, setFilter, resetFilters } = useFilters()
    const { toggle } = useSidebar()

    const meta = PAGE_META[pathname] ?? { title: 'Analytics', sub: '' }
    const hasActiveFilters = !!(filters.category || filters.brand || filters.startDate || filters.endDate || filters.segment)

    return (
        <header
            className="flex items-center gap-4 px-5 shrink-0 z-20 sticky top-0 header-root header-height"
            style={{ background: 'var(--bg-header)' }}
        >
            {/* Left: toggle + page title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                    onClick={toggle}
                    className="p-1.5 header-toggle-btn flex-shrink-0 transition-all"
                    title="Toggle sidebar"
                >
                    <Menu className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-[13px] font-semibold leading-none truncate" style={{ color: 'var(--text-primary)' }}>
                        {meta.title}
                    </h1>
                    {meta.sub && (
                        <p className="text-[10px] mt-[3px] leading-none truncate hidden sm:block text-muted-400">
                            {meta.sub}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: filters */}
            <div className="flex items-center gap-2 flex-shrink-0">

                {/* Date range */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 header-date-pill">
                    <CalendarDays className="w-3 h-3 flex-shrink-0 header-calendar-icon" />
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={e => setFilter('startDate', e.target.value)}
                        min={filtersData.date_bounds?.min_date}
                        max={filtersData.date_bounds?.max_date}
                        title="Start date" aria-label="Start date"
                        className="bg-transparent border-none text-[11px] outline-none cursor-pointer w-[100px] font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                    />
                    <span className="text-xs header-date-sep">–</span>
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={e => setFilter('endDate', e.target.value)}
                        min={filtersData.date_bounds?.min_date}
                        max={filtersData.date_bounds?.max_date}
                        title="End date" aria-label="End date"
                        className="bg-transparent border-none text-[11px] outline-none cursor-pointer w-[100px] font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                    />
                </div>

                <div className="hidden md:block w-px h-4 header-divider" />

                {/* Category */}
                <div className="relative hidden lg:block">
                    <select
                        value={filters.category}
                        onChange={e => setFilter('category', e.target.value)}
                        className="filter-select pr-7 w-36"
                        aria-label="Filter by category" title="Filter by category"
                    >
                        <option value="">All Categories</option>
                        {filtersData.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none header-caret" />
                </div>

                {/* Brand */}
                <div className="relative hidden lg:block">
                    <select
                        value={filters.brand}
                        onChange={e => setFilter('brand', e.target.value)}
                        className="filter-select pr-7 w-28"
                        aria-label="Filter by brand" title="Filter by brand"
                    >
                        <option value="">All Brands</option>
                        {filtersData.brands.slice(0, 80).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none header-caret" />
                </div>

                <div className="hidden md:block w-px h-4 header-divider" />

                {/* Segment selector */}
                <div className="relative hidden lg:flex items-center gap-1.5">
                    <Users className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                    <select
                        value={filters.segment}
                        onChange={e => setFilter('segment', e.target.value)}
                        className="filter-select pr-7 w-36"
                        aria-label="Filter by user segment" title="Filter by user segment"
                        style={filters.segment ? { color: 'var(--primary)', fontWeight: 600 } : undefined}
                    >
                        {SEGMENT_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none header-caret" />
                </div>

                {/* Mobile filter button */}
                <button className="flex lg:hidden items-center gap-1.5 h-7 px-2.5 text-xs font-semibold header-mobile-filter transition-all">
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Filters</span>
                </button>

                {/* Clear */}
                {hasActiveFilters && (
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-1 h-7 px-2.5 text-xs font-semibold header-clear-btn transition-all"
                    >
                        <X className="w-3 h-3" />
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                )}
            </div>
        </header>
    )
}
