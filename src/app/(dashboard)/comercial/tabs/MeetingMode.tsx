'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Play, RotateCcw, X } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { cn } from '@/lib/utils'
import { enterFullscreen, PresentationPlayer, type PlayerMaterial } from './PresentationPlayer'
import { PresentationPreparationCache } from './presentation-preloader'

type MeetingStatus = 'idle' | 'preparing' | 'ready' | 'error' | 'starting'

const STATUS_COPY: Record<MeetingStatus, string> = {
  idle: 'Preparação ainda não iniciada',
  preparing: 'Carregando primeiro material…',
  ready: 'Apresentação pronta',
  error: 'Não foi possível preparar o primeiro material',
  starting: 'Iniciando apresentação…',
}

export function MeetingMode({ name, client, materials, onClose }: {
  name: string
  client?: string | null
  materials: PlayerMaterial[]
  onClose: () => void
}) {
  const [status, setStatus] = useState<MeetingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [fullscreenAlreadyRequested, setFullscreenAlreadyRequested] = useState(false)
  const { ref, dialogProps } = useDialog<HTMLDivElement>(onClose, !playing)
  const cache = useMemo(() => new PresentationPreparationCache(() => {
    const padding = window.innerWidth >= 640 ? 64 : 32
    return Math.max(window.innerWidth - padding - 16, 100)
  }), [])
  const first = materials[0]

  const prepare = useCallback(async () => {
    if (!first) {
      setError('Esta apresentação não possui um primeiro material disponível.')
      setStatus('error')
      return
    }
    setError(null)
    setStatus('preparing')
    try {
      await cache.prepare(first)
      setStatus('ready')
      // O segundo material aquece depois do primeiro frame, sem bloquear o botão.
      if (materials[1]) cache.prepare(materials[1]).catch(() => { /* segue sob demanda no player */ })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o primeiro material.')
      setStatus('error')
    }
  }, [cache, first, materials])

  useEffect(() => {
    prepare()
  }, [prepare])

  useEffect(() => () => cache.dispose(), [cache])

  const start = async () => {
    if (status !== 'ready') return
    setStatus('starting')
    // A solicitação nasce diretamente no clique. O fullscreen usa o documentElement para que
    // o player portado para o body continue sendo descendente do elemento em fullscreen.
    const entered = await enterFullscreen(document.documentElement).then(() => true).catch(() => false)
    setFullscreenAlreadyRequested(entered)
    setPlaying(true)
  }

  if (playing) {
    return (
      <PresentationPlayer
        name={name}
        client={client}
        materials={materials}
        preparationCache={cache}
        fullscreenAlreadyRequested={fullscreenAlreadyRequested}
        onClose={() => { setPlaying(false); setStatus('ready') }}
      />
    )
  }

  const busy = status === 'preparing' || status === 'starting'

  return (
    <Portal>
      <div ref={ref} {...dialogProps} aria-labelledby="meeting-title"
        className="fixed inset-0 z-[300] overflow-y-auto bg-[#080d0a] text-white">
        <div className="pointer-events-none fixed inset-0 opacity-70"
          style={{ background: 'radial-gradient(circle at 50% 35%, rgba(182,255,59,0.09), transparent 42%)' }} />

        <div className="relative min-h-full flex flex-col px-5 sm:px-8 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <BrandMark size={36} decorative />
              <div className="min-w-0">
                <p className="font-display font-semibold text-sm text-white">Escritório Digital</p>
                <p className="font-tech text-[10px] uppercase tracking-[0.14em] text-white/45">Modo de Reunião</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Voltar ao Studio"
              className="inline-flex items-center gap-2 rounded-btn border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/65 hover:border-white/30 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao Studio</span>
              <X className="w-4 h-4 sm:hidden" />
            </button>
          </header>

          <main className="flex-1 flex items-center justify-center py-12">
            <section className="w-full max-w-2xl text-center">
              <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-lime-fg">Reunião preparada para compartilhar</p>
              <h1 id="meeting-title" className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance">{name}</h1>
              {client && <p className="mt-3 text-sm sm:text-base text-white/50">{client}</p>}

              <div className="mx-auto mt-10 max-w-md rounded-frame border border-white/10 bg-white/[0.035] p-5 sm:p-6 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-center">
                  <span className={cn('w-12 h-12 rounded-full flex items-center justify-center',
                    status === 'ready' ? 'bg-lime/15 text-lime' : status === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-white/60')}>
                    {busy ? <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />
                      : status === 'ready' ? <Check className="w-5 h-5" />
                        : status === 'error' ? <X className="w-5 h-5" />
                          : <Play className="w-5 h-5" />}
                  </span>
                </div>

                <div className="mt-4 min-h-[44px]" aria-live="polite" aria-atomic="true">
                  <p className={cn('text-sm font-semibold', status === 'ready' ? 'text-lime-fg' : status === 'error' ? 'text-red-300' : 'text-white/75')}>
                    {STATUS_COPY[status]}
                  </p>
                  {error && <p className="mt-1 text-xs text-white/45">{error}</p>}
                </div>

                {status === 'error' ? (
                  <button type="button" onClick={prepare}
                    className="mt-5 w-full min-h-[48px] rounded-btn border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime">
                    <span className="inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" />Tentar novamente</span>
                  </button>
                ) : (
                  <button type="button" onClick={start} disabled={status !== 'ready'}
                    className="bento-btn mt-5 w-full min-h-[48px] rounded-btn px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d0a]">
                    {status === 'ready' ? 'Iniciar apresentação' : status === 'starting' ? 'Iniciando…' : 'Preparando apresentação…'}
                  </button>
                )}
              </div>

              <p className="mt-6 font-tech text-[10px] uppercase tracking-[0.12em] text-white/25">
                Compartilhe esta tela quando a apresentação estiver pronta
              </p>
            </section>
          </main>
        </div>
      </div>
    </Portal>
  )
}
