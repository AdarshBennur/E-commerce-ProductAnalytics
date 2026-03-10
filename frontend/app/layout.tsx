import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { FilterProvider } from '@/lib/filter-context'
import { SidebarProvider } from '@/lib/sidebar-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { FiltersData } from '@/lib/types'
import './globals.css'

// Force dynamic rendering — prevents build-time API calls that would hang.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Product Analytics Dashboard',
    description: 'E-commerce analytics dashboard powered by pre-aggregated Parquet analytics tables.',
}

const EMPTY_FILTERS: FiltersData = {
    categories: [],
    brands: [],
    date_bounds: { min_date: '', max_date: '' },
}

async function loadFilters(): Promise<FiltersData> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    try {
        const res = await fetch('http://localhost:8000/api/filters', {
            signal: controller.signal,
            cache: 'no-store',
        })
        if (!res.ok) return EMPTY_FILTERS
        return res.json()
    } catch {
        return EMPTY_FILTERS
    } finally {
        clearTimeout(timer)
    }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const filtersData = await loadFilters()

    return (
        <html lang="en">
            <body>
                <FilterProvider>
                    <SidebarProvider>
                        <div className="flex h-screen overflow-hidden">
                            <Sidebar />
                            {/* Main content shifts right with sidebar; transitions smoothly */}
                            <div className="flex-1 flex flex-col overflow-hidden main-transition">
                                <TopBar filtersData={filtersData} />
                                <main className="flex-1 overflow-y-auto p-6">
                                    {children}
                                </main>
                            </div>
                        </div>
                    </SidebarProvider>
                </FilterProvider>
                <Analytics />
            </body>
        </html>
    )
}
