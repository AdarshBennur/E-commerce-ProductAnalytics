'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Filters } from '@/lib/types'

interface FilterContextType {
    filters: Filters
    setFilter: (key: keyof Filters, value: string) => void
    resetFilters: () => void
}

const DEFAULT_FILTERS: Filters = {
    startDate: '',
    endDate: '',
    category: '',
    brand: '',
    segment: '',
}

const FilterContext = createContext<FilterContextType | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

    const setFilter = useCallback((key: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }, [])

    const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

    return (
        <FilterContext.Provider value={{ filters, setFilter, resetFilters }}>
            {children}
        </FilterContext.Provider>
    )
}

export function useFilters() {
    const ctx = useContext(FilterContext)
    if (!ctx) throw new Error('useFilters must be inside FilterProvider')
    return ctx
}
