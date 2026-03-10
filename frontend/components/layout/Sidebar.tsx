'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingDown, Users,
    Activity, ShoppingBag, DollarSign,
    ChevronLeft, ChevronRight, BarChart3,
    FlaskConical,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useSidebar } from '@/lib/sidebar-context'

const NAV_GROUPS = [
    {
        label: 'Dashboards',
        items: [
            { href: '/overview',   label: 'Overview',    icon: LayoutDashboard },
            { href: '/funnel',     label: 'Funnel',       icon: TrendingDown },
            { href: '/retention',  label: 'Retention',    icon: Users },
            { href: '/behavior',   label: 'Behavior',     icon: Activity },
            { href: '/categories', label: 'Categories',   icon: ShoppingBag },
            { href: '/revenue',    label: 'Revenue',      icon: DollarSign },
        ],
    },
    {
        label: 'Platform',
        items: [
            { href: '/experiments', label: 'Experiments', icon: FlaskConical },
        ],
    },
]

// Flat list used for collapsed icon-only mode
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export function Sidebar() {
    const pathname = usePathname()
    const { collapsed, toggle } = useSidebar()

    return (
        <aside
            className="fixed top-0 left-0 h-screen flex flex-col z-30 sidebar-transition sidebar-root"
            style={{
                width:           collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                background:      'var(--bg-sidebar)',
            }}
        >
            {/* Brand */}
            <div className={clsx(
                'flex items-center flex-shrink-0 sidebar-brand-section',
                collapsed ? 'justify-center h-[56px]' : 'gap-3 px-5 h-[56px]',
            )}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 sidebar-brand-icon shadow-primary">
                    <BarChart3 className="w-3.5 h-3.5 text-white" />
                </div>
                {!collapsed && (
                    <div className="min-w-0 animate-fade-in">
                        <p className="text-[13px] font-bold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            Analytics
                        </p>
                        <p className="sidebar-brand-subtitle mt-0.5 font-medium">
                            Product Intelligence
                        </p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className={clsx(
                'flex-1 py-3 overflow-y-auto overflow-x-hidden',
                collapsed ? 'px-2 space-y-0.5' : 'px-3',
            )}>
                {collapsed
                    ? /* ── Collapsed: icon-only flat list ── */
                      ALL_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                          const active = pathname === href || pathname.startsWith(href + '/')
                          return (
                              <div key={href} className="relative group mb-0.5">
                                  <Link
                                      href={href}
                                      className={clsx(
                                          'flex items-center justify-center w-full h-9 rounded-lg transition-all duration-150 nav-item',
                                          active && 'nav-item-active',
                                      )}
                                  >
                                      <Icon className="w-4 h-4" />
                                  </Link>
                                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 text-xs font-semibold"
                                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)' }}>
                                      {label}
                                  </div>
                              </div>
                          )
                      })
                    : /* ── Expanded: grouped with section labels ── */
                      NAV_GROUPS.map(group => (
                          <div key={group.label} className="mb-4">
                              <p className="px-2.5 mb-1.5 sidebar-section-label text-[9.5px] font-bold uppercase tracking-[0.12em]">
                                  {group.label}
                              </p>
                              <div className="space-y-0.5">
                                  {group.items.map(({ href, label, icon: Icon }) => {
                                      const active = pathname === href || pathname.startsWith(href + '/')
                                      return (
                                          <Link
                                              key={href}
                                              href={href}
                                              className={clsx('nav-item', active && 'nav-item-active')}
                                          >
                                              <Icon className={clsx('nav-item-icon', active && 'text-primary')} />
                                              <span className="truncate">{label}</span>
                                              {active && (
                                                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 sidebar-active-dot" />
                                              )}
                                          </Link>
                                      )
                                  })}
                              </div>
                          </div>
                      ))
                }
            </nav>

            {/* Footer */}
            <div className={clsx('flex-shrink-0 sidebar-footer', collapsed ? 'p-2' : 'px-3 py-3')}>
                {!collapsed && (
                    <div className="px-2.5 mb-2.5">
                        <p className="text-[10px] leading-relaxed sidebar-footer-text">
                            285M+ events · Nov 2019
                        </p>
                        <p className="text-[9.5px] sidebar-footer-sub">E-commerce dataset</p>
                    </div>
                )}
                <button
                    onClick={toggle}
                    className={clsx(
                        'rounded-lg text-xs font-medium transition-all duration-150 sidebar-collapse-btn',
                        collapsed ? 'flex items-center justify-center w-full h-9' : 'flex items-center gap-2 w-full px-2.5 py-2',
                    )}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>
                    }
                </button>
            </div>
        </aside>
    )
}
