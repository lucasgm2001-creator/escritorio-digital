'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2, Play, RotateCcw, Sparkles, X } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { cn } from '@/lib/utils'
import { enterFullscreen, PresentationPlayer, type PlayerMaterial } from './PresentationPlayer'
import { PresentationPreparationCache } from './presentation-preloader'

type MeetingStatus = 'idle' | 'preparing' | 'ready' | 'error' | 'starting'

const STATUS_COPY: Record<MeetingStatus, string> = {
  idle: 'Preparando sua experiência',
  preparing: 'Cuidando dos últimos detalhes…',
  ready: 'Tudo pronto para começar',
  error: 'Precisamos de mais um instante',
  starting: 'Abrindo apresentação…',
}

export function MeetingMode({ name, client, materials, onClose }: {
  name: string
  client?: string | null
  materials: PlayerMaterial[]
  onClose: () => void
}) {
  const [status, setStatus] = useState<MeetingStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preparedCount, setPreparedCount] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fullscreenAlreadyRequested, setFullscreenAlreadyRequested] = useState(false)
  const preparationRun = useRef(0)
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { ref, dialogProps } = useDialog<HTMLDivElement>(onClose, !playing)
  const cache = useMemo(() => new PresentationPreparationCache(() => {
    const padding = window.innerWidth >= 640 ? 64 : 32
    return Math.max(window.innerWidth - padding - 16, 100)
  }), [])

  const prepare = useCallback(async () => {
    const run = ++preparationRun.current
    if (materials.length === 0) {
      setError('Nenhum material está disponível nesta apresentação.')
      setStatus('error')
      return
    }
    setError(null)
    setPreparedCount(0)
    setStatus('preparing')
    try {
      // Só libera o início quando TODOS os materiais renderizáveis tiverem sido
      // carregados e decodificados. Assim o último slide não estreia em branco.
      await Promise.all(materials.map(material => cache.prepare(material).then(result => {
        if (preparationRun.current === run) setPreparedCount(count => count + 1)
        return result
      })))
      if (preparationRun.current === run) setStatus('ready')
    } catch (cause) {
      if (preparationRun.current !== run) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar todos os materiais.')
      setStatus('error')
    }
  }, [cache, materials])

  useEffect(() => {
    prepare()
  }, [prepare])

  // O descarte adiado evita que o ciclo de verificação do React Strict Mode
  // invalide o cache entre o primeiro e o segundo setup em desenvolvimento.
  useEffect(() => {
    if (disposeTimer.current) clearTimeout(disposeTimer.current)
    return () => {
      preparationRun.current += 1
      disposeTimer.current = setTimeout(() => cache.dispose(), 0)
    }
  }, [cache])

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
                <p className="font-tech text-[10px] uppercase tracking-[0.14em] text-white/45">Apresentação Executiva</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Encerrar apresentação"
              className="inline-flex items-center gap-2 rounded-btn border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/65 hover:border-white/30 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Encerrar</span>
              <X className="w-4 h-4 sm:hidden" />
            </button>
          </header>

          <main className="flex-1 flex items-center justify-center py-12">
            <section className="w-full max-w-2xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/[0.07] px-3 py-1.5 text-lime-fg">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-tech text-[10px] uppercase tracking-[0.18em]">Escritório Digital apresenta</span>
              </div>
              <h1 id="meeting-title" className="mt-5 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance">{name}</h1>
              {client && <p className="mt-3 text-sm sm:text-base text-white/55">Preparado especialmente para <span className="font-semibold text-white/80">{client}</span></p>}

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
                  {status === 'ready' && <p className="mt-1.5 text-xs leading-relaxed text-white/45">Uma conversa pensada para gerar clareza, direção e próximos passos.</p>}
                  {status === 'preparing' && (
                    <p className="mt-1.5 text-xs text-white/45">Preparando {preparedCount + 1 > materials.length ? materials.length : preparedCount + 1} de {materials.length}</p>
                  )}
                  {error && <p className="mt-1.5 text-xs text-white/45">{error}</p>}
                </div>

                {status === 'preparing' && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                    <div className="h-full rounded-full bg-lime transition-[width] duration-300"
                      style={{ width: `${Math.max(6, (preparedCount / materials.length) * 100)}%` }} />
                  </div>
                )}

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
                Estratégia, clareza e próximos passos em uma experiência feita para você
              </p>
            </section>
          </main>
        </div>
      </div>
    </Portal>
  )
}
