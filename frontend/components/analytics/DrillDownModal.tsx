'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface DrillDownModalProps {
    open:      boolean
    onClose:   () => void
    title:     string
    subtitle?: string
    children:  React.ReactNode
    width?:    'md' | 'lg' | 'xl'
}

export function DrillDownModal({
    open,
    onClose,
    title,
    subtitle,
    children,
    width = 'lg',
}: DrillDownModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    // Lock body scroll
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [open])

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    if (!open) return null

    const widthClass = {
        md: 'max-w-xl',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    }[width]

    const modal = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === overlayRef.current) onClose() }}
        >
            <div
                className={clsx(
                    'w-full rounded-2xl shadow-2xl animate-scale-in flex flex-col',
                    'max-h-[88vh]',
                    widthClass,
                )}
                style={{ background: '#fff', border: '1px solid #E2E8F0' }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
                        {subtitle && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: '#F1F5F9', color: '#64748B' }}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    {children}
                </div>
            </div>
        </div>
    )

    return createPortal(modal, document.body)
}

// ── Reusable stat row inside modal ────────────────────────────────────────

interface ModalStatRowProps {
    label:    string
    value:    string | number
    sub?:     string
    color?:   string
    rank?:    number
}

export function ModalStatRow({ label, value, sub, color, rank }: ModalStatRowProps) {
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
            {rank != null && (
                <span className="text-[10px] font-bold text-slate-300 w-5 flex-shrink-0 tabular-nums">
                    {rank}
                </span>
            )}
            {color && (
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 truncate">{label}</p>
                {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
            </div>
            <span className="text-[13px] font-bold text-slate-800 tabular-nums flex-shrink-0">
                {value}
            </span>
        </div>
    )
}

// ── Two-column stat grid inside modal ─────────────────────────────────────

interface ModalKpiProps { label: string; value: string; sub?: string; accent?: string }

export function ModalKpi({ label, value, sub, accent = '#4F46E5' }: ModalKpiProps) {
    return (
        <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
            <p className="text-[22px] font-extrabold leading-none" style={{ color: accent }}>{value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
        </div>
    )
}
