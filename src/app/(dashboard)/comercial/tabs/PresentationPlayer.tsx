'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

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

// ─── Player: tela cheia, sequência com setas + menu lateral pra pular ────────────
export function PresentationPlayer({ name, materials, onClose }: {
  name: string
  materials: PlayerMaterial[]
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

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

  // Teclado: setas/espaço navega, Home/End extremos, ESC sai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': e.preventDefault(); go(0); break
        case 'End': e.preventDefault(); go(total - 1); break
        case 'Escape': close(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, close, total])

  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur()

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] bg-black select-none">
      {/* Conteúdo */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        {current ? <MaterialFrame material={current} /> : <p className="text-white/60 text-sm">Sem material disponível.</p>}
      </div>

      {/* Setas */}
      {total > 1 && (
        <>
          <button onClick={e => { blur(e); prev() }} disabled={index === 0} aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white p-3 rounded-full backdrop-blur-sm transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={e => { blur(e); next() }} disabled={index === total - 1} aria-label="Próximo"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white p-3 rounded-full backdrop-blur-sm transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {/* Botão de menu (canto superior ESQUERDO, cor do tema) + nome */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 max-w-[70vw]">
        <button onClick={e => { blur(e); setMenuOpen(o => !o) }} title="Materiais" aria-label="Materiais"
          className="flex-none bg-lime hover:bg-lime-hover text-lime-ink p-2.5 rounded-xl shadow-card-hover transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {!menuOpen && (
          <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full truncate">{name}</p>
        )}
      </div>

      {/* Fechar (canto superior direito) */}
      <div className="absolute top-4 right-4 z-40">
        <button onClick={close} title="Fechar (ESC)"
          className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl backdrop-blur-sm transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Contador */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full tabular-nums">{index + 1} de {total}</p>
      </div>

      {/* Menu lateral (abre/fecha pelo botão) — clique num nome pula pra ele */}
      {menuOpen && (
        <>
          <div className="absolute inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <aside className="absolute top-0 left-0 z-30 h-full w-72 max-w-[80vw] bg-bento-panel/95 backdrop-blur-sm border-r border-white/10 overflow-y-auto p-3 pt-16">
            <p className="text-white/50 text-[11px] font-medium px-2 pb-2 truncate">{name}</p>
            <div className="space-y-1">
              {materials.map((m, i) => (
                <button key={m.id} onClick={() => { go(i); setMenuOpen(false) }}
                  className={cn('w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors',
                    i === index ? 'bg-lime/20 text-lime-fg' : 'text-white/70 hover:bg-white/10')}>
                  <span className="flex-none w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[11px] tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{m.name}</span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
