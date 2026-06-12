'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error'
interface ToastItem { id: number; type: ToastType; message: string }

interface ToastCtx { toast: (t: { type: ToastType; message: string }) => void }
const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((t: { type: ToastType; message: string }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 5000)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(x => x.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-[calc(100vw-3rem)]">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-card-hover animate-slide-up text-sm w-full sm:max-w-sm',
              t.type === 'success'
                ? 'bg-lime-soft border-lime/30 text-lime-soft-fg'
                : 'bg-red-900/90 border-red-700/60 text-red-200',
            )}
          >
            {t.type === 'success' ? (
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Fechar" className="opacity-60 hover:opacity-100 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
