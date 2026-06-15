'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export type PresentationMode = 'sequencia' | 'livre' | 'foco'

export interface PlayerMaterial {
  id: string
  name: string
  url: string
  mime_type: string | null
}

// ─── Fullscreen helpers (com prefixo webkit p/ Safari) ──────────────────────────
function enterFullscreen(el: HTMLElement): Promise<unknown> {
  const fn = el.requestFullscreen || (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
  if (!fn) return Promise.reject(new Error('sem suporte a fullscreen'))
  try { return Promise.resolve(fn.call(el)) } catch (e) { return Promise.reject(e) }
}
function exitFullscreen() {
  const fn = document.exitFullscreen || (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
  if (fn) { try { fn.call(document) } catch { /* noop */ } }
}
function fullscreenElement(): Element | null {
  return document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement || null
}

// ─── Renderiza UMA peça (imagem / PDF limpo / fallback) — reusado na Gaveta ──────
export function MaterialFrame({ material }: { material: PlayerMaterial }) {
  const t = material.mime_type ?? ''
  if (t.startsWith('image/')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={material.url} alt={material.name} className="max-w-full max-h-full object-contain" />
  }
  if (t === 'application/pdf') {
    // Esconde a "tralha" do visualizador nativo: barra, painel de páginas e scrollbar.
    return (
      <iframe
        src={`${material.url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
        title={material.name}
        className="w-full h-full bg-white rounded-sm"
      />
    )
  }
  // Tipos sem preview no navegador (ex: PPT/PPTX) → oferece download.
  return (
    <div className="text-center text-white/70 px-6">
      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <p className="mt-4 text-sm">{material.name}</p>
      <a href={material.url} download={material.name}
        className="bento-btn mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-btn text-sm">
        Baixar arquivo
      </a>
    </div>
  )
}

// ─── Player: tela cheia, 3 modos, navegação por teclado e clique ────────────────
export function PresentationPlayer({ name, materials, initialMode, onClose }: {
  name: string
  materials: PlayerMaterial[]
  initialMode: PresentationMode
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<PresentationMode>(initialMode)
  const [controlsVisible, setControlsVisible] = useState(true)

  const total = materials.length
  const current = materials[index]

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total])
  const next = useCallback(() => setIndex(i => Math.min(total - 1, i + 1)), [total])
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [total])

  const close = useCallback(() => {
    if (fullscreenElement()) exitFullscreen()
    onClose()
  }, [onClose])

  // Entra em tela cheia ao abrir; se sair da tela cheia (ESC/F11), fecha o player.
  useEffect(() => {
    const el = rootRef.current
    let entered = false
    if (el) enterFullscreen(el).then(() => { entered = true }).catch(() => { /* fallback: overlay cobre a tela */ })
    const onFsChange = () => { if (entered && !fullscreenElement()) onClose() }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener)
      if (fullscreenElement()) exitFullscreen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Teclado: setas/espaço navega, Home/End extremos, 1/2/3 troca modo, ESC sai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': e.preventDefault(); go(0); break
        case 'End': e.preventDefault(); go(total - 1); break
        case 'Escape': close(); break
        case '1': setMode('sequencia'); break
        case '2': setMode('livre'); break
        case '3': setMode('foco'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, close, total])

  // Modo Foco: os controles somem sozinhos; reaparecem ao mexer o mouse.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setControlsVisible(true)
    if (mode === 'foco') hideTimer.current = setTimeout(() => setControlsVisible(false), 2500)
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [mode])

  const pokeControls = () => {
    if (mode !== 'foco') return
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500)
  }

  const chromeVisible = mode !== 'foco' || controlsVisible
  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur()

  return (
    <div ref={rootRef} onMouseMove={pokeControls}
      className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      <div className="flex-1 flex min-h-0">
        {/* Índice (modo Livre) */}
        {mode === 'livre' && (
          <aside className="w-60 shrink-0 bg-bento-panel/95 border-r border-white/10 overflow-y-auto p-3">
            <p className="text-white/50 text-[11px] font-medium px-2 pb-2 truncate">{name}</p>
            <div className="space-y-1">
              {materials.map((m, i) => (
                <button key={m.id} onClick={e => { blur(e); go(i) }}
                  className={cn('w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors',
                    i === index ? 'bg-lime/20 text-lime-fg' : 'text-white/70 hover:bg-white/10')}>
                  <span className="flex-none w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[11px] tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{m.name}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Conteúdo */}
        <div className="relative flex-1 flex items-center justify-center min-w-0 p-4 sm:p-8">
          {current ? <MaterialFrame material={current} /> : <p className="text-white/60 text-sm">Sem material disponível.</p>}

          {/* Setas clicáveis (somem no Foco até mexer o mouse) */}
          {chromeVisible && total > 1 && (
            <>
              <button onClick={e => { blur(e); prev() }} disabled={index === 0} aria-label="Anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white p-3 rounded-full backdrop-blur-sm transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={e => { blur(e); next() }} disabled={index === total - 1} aria-label="Próximo"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white p-3 rounded-full backdrop-blur-sm transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cromo: nome + troca de modo + fechar + contador */}
      {chromeVisible && (
        <>
          {mode !== 'livre' && (
            <div className="absolute top-4 left-4 z-10">
              <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full max-w-[60vw] truncate">{name}</p>
            </div>
          )}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <div className="hidden sm:flex bg-black/40 backdrop-blur-sm rounded-full p-1 gap-1">
              {([['sequencia', 'Sequência'], ['livre', 'Livre'], ['foco', 'Foco']] as const).map(([m, label]) => (
                <button key={m} onClick={e => { blur(e); setMode(m) }}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                    mode === m ? 'bg-lime text-lime-ink' : 'text-white/60 hover:text-white')}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={close} title="Fechar (ESC)"
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl backdrop-blur-sm transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full tabular-nums">{index + 1} / {total}</p>
          </div>
        </>
      )}
    </div>
  )
}
