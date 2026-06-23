'use client'

import { useState, useEffect, useMemo, useRef, type MouseEvent } from 'react'
import usMap from '@/data/us-map.json'
import { cn } from '@/lib/utils'
import { getMapSkin, getMapSep, MAP_SETTINGS_EVENT, type MapSkin } from '@/lib/mapSettings'
import type { Lead } from '../types'
import type { Client } from '../../clientes/ClientesClient'

// ── Mapa de Clientes (EUA). Geografia = src/data/us-map.json; pontos = dados reais do Supabase
//    (clientes ativos = verde; leads em aberto = azul-celeste). Visual portado do mockup. ──

type Region = 'W' | 'C' | 'E'
type Filter = 'todos' | 'clientes' | 'leads'

const DIR: Record<Region, number> = { W: -1, C: 0, E: 1 }   // deslocamento das placas (×SEP)
const REGION_TZ: Record<Region, string> = { W: 'Oeste', C: 'Centro', E: 'Leste' }
const OPEN_EXCLUDE = new Set(['fechado', 'perdido', 'lixeira'])   // leads "fechados" não entram

const MAP = usMap as unknown as {
  W: number; H: number
  regions: { key: Region; name: string; fill: string; lines: string; lx: number; ly: number }[]
  areaCodes: Record<string, { x: number; y: number; st: string; region: Region; city: string }>
  states: Record<string, { x: number; y: number; region: Region }>
}

interface Loc {
  key: string; x: number; y: number; region: Region
  st: string; code: string | null; city: string
  clients: string[]; novos: string[]; leads: string[]   // novos = leads na fase 'novo' (ponto roxo); leads = demais abertos
}

export function MapaTab({ leads, clients }: { leads: Lead[]; clients: Client[] }) {
  const [skin, setSkin] = useState<MapSkin>('blue')
  const [sep, setSep] = useState<number>(4)
  const [filter, setFilter] = useState<Filter>('todos')
  const [hot, setHot] = useState<Region | null>(null)   // região sob o mouse (acende o contorno)
  const [sel, setSel] = useState<{ loc: Loc; left: number; top: number; mobile: boolean } | null>(null)
  // Fit do SVG na tela: dimensiona pela MENOR dimensão (largura OU altura visível), mantendo 1000:624.
  const outerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: MAP.W, h: MAP.H, scale: 1 })
  // SEP fino: "Justo" (4) renderiza 2; "Espaçoso" (16) mantém. Não toca no toggle/localStorage.
  const effSep = sep === 4 ? 2 : sep

  // Lê as configs (localStorage) e reage a mudanças feitas em Configurações.
  useEffect(() => {
    const sync = () => { setSkin(getMapSkin()); setSep(getMapSep()) }
    sync()
    window.addEventListener(MAP_SETTINGS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(MAP_SETTINGS_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])

  // Mapa INTEIRO na tela: mede a largura do palco e a altura visível abaixo dele; escala pela menor.
  useEffect(() => {
    const PAD = 14, GAP = 40   // padding do palco (cada lado) + espaço da legenda + folga embaixo
    const recompute = () => {
      const el = stageRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      const availW = el.clientWidth - PAD * 2
      const availH = window.innerHeight - top - PAD * 2 - GAP
      if (availW <= 0 || availH <= 0) return
      const scale = Math.min(availW / MAP.W, availH / MAP.H)
      const w = Math.round(MAP.W * scale), h = Math.round(MAP.H * scale)
      setBox(prev => (prev.w === w && prev.h === h ? prev : { w, h, scale }))
    }
    recompute()
    const ro = new ResizeObserver(recompute)   // observa o container externo (altura estável) → sem loop
    if (outerRef.current) ro.observe(outerRef.current)
    window.addEventListener('resize', recompute)
    const t = setTimeout(recompute, 120)        // re-mede após fontes/layout assentarem
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); clearTimeout(t) }
  }, [])

  // Fecha o popover com Esc / clique fora (mas não em pin nem no próprio painel).
  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    const onDoc = (e: globalThis.MouseEvent) => {
      const t = e.target as Element
      if (t.closest?.('.ed-map-panel') || t.closest?.('.pin')) return
      setSel(null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDoc)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc) }
  }, [sel])

  // Agrupa por DDD (area_code); sem DDD, agrupa por estado.
  const locations = useMemo(() => {
    const map = new Map<string, Loc>()
    const place = (rec: { area_code?: string | null; state?: string | null }): Loc | null => {
      const code = (rec.area_code ?? '').trim()
      if (code && MAP.areaCodes[code]) {
        const a = MAP.areaCodes[code]; const key = 'c:' + code
        let loc = map.get(key)
        if (!loc) { loc = { key, x: a.x, y: a.y, region: a.region, st: a.st, code, city: a.city, clients: [], novos: [], leads: [] }; map.set(key, loc) }
        return loc
      }
      const st = (rec.state ?? '').trim().toUpperCase()
      if (st && MAP.states[st]) {
        const s = MAP.states[st]; const key = 's:' + st
        let loc = map.get(key)
        if (!loc) { loc = { key, x: s.x, y: s.y, region: s.region, st, code: null, city: '', clients: [], novos: [], leads: [] }; map.set(key, loc) }
        return loc
      }
      return null
    }
    for (const c of clients) { if (c.status === 'ativo') { const loc = place(c); if (loc) loc.clients.push(c.name || 'Cliente') } }
    for (const l of leads) {
      if (OPEN_EXCLUDE.has(l.status)) continue
      const loc = place(l); if (!loc) continue
      if (l.status === 'novo') loc.novos.push(l.name || 'Lead')   // fase Novo → ponto roxo
      else loc.leads.push(l.name || 'Lead')                       // demais abertos → azul-céu
    }
    return Array.from(map.values())
  }, [leads, clients])

  const totalClients = useMemo(() => locations.reduce((s, l) => s + l.clients.length, 0), [locations])
  // "novo" continua contando como Lead (contador inalterado).
  const totalLeads = useMemo(() => locations.reduce((s, l) => s + l.novos.length + l.leads.length, 0), [locations])

  const openPanel = (loc: Loc, e: MouseEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect()
    const mobile = window.innerWidth <= 700
    if (mobile) { setSel({ loc, left: 0, top: 0, mobile }); return }
    const pw = 268, ph = 260
    let left = r.right + 14, top = r.top - 12
    if (left + pw > window.innerWidth - 12) left = r.left - pw - 14
    if (left < 12) left = 12
    if (top + ph > window.innerHeight - 12) top = window.innerHeight - ph - 12
    if (top < 12) top = 12
    setSel({ loc, left, top, mobile })
  }

  return (
    <div ref={outerRef} className="h-full overflow-hidden bg-bento-bg p-4 sm:p-6">
      <div className={cn('ed-map max-w-[1180px] mx-auto', 'skin-' + skin)}>
        {/* Barra (filtro + contadores) — nada flutua sobre o mapa */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-bold text-bento-text text-lg">Mapa de Clientes</h2>
            <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1">
              {(['todos', 'clientes', 'leads'] as Filter[]).map(f => (
                <button key={f} onClick={() => { setFilter(f); setSel(null) }}
                  className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                    filter === f ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                  {f === 'todos' ? 'Todos' : f === 'clientes' ? 'Clientes' : 'Leads'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Counter label="Cidades" value={locations.length} />
            <Counter label="Clientes" value={totalClients} cls="text-green-500" />
            <Counter label="Leads" value={totalLeads} cls="text-sky-400" />
          </div>
        </div>

        {/* Palco do mapa */}
        <div className="ed-map-stage" ref={stageRef}>
          <svg className="ed-map-svg" viewBox={`0 0 ${MAP.W} ${MAP.H}`} preserveAspectRatio="xMidYMid meet"
            width={box.w} height={box.h} style={{ width: box.w, height: box.h, margin: '0 auto', display: 'block' }}
            xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa dos EUA com clientes e leads">
            <defs>
              <radialGradient id="ed-g-cli-l" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#62d18d" /><stop offset=".5" stopColor="#15a34a" /><stop offset="1" stopColor="#0b6e33" /></radialGradient>
              <radialGradient id="ed-g-led-l" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#6cc6f2" /><stop offset=".5" stopColor="#0ea5e9" /><stop offset="1" stopColor="#0a78b8" /></radialGradient>
              <radialGradient id="ed-g-cli-d" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#34e27d" /><stop offset="1" stopColor="#13a651" /></radialGradient>
              <radialGradient id="ed-g-led-d" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#73d2ff" /><stop offset="1" stopColor="#1f9ee6" /></radialGradient>
              {/* Leads na fase "Novo" — roxo #c026d3 (mesma estrutura do gradiente de lead) */}
              <radialGradient id="ed-g-novo-l" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#db7ae8" /><stop offset=".5" stopColor="#c026d3" /><stop offset="1" stopColor="#8a1b9c" /></radialGradient>
              <radialGradient id="ed-g-novo-d" cx="38%" cy="34%" r="72%"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#db7ae8" /><stop offset="1" stopColor="#a821bd" /></radialGradient>
              <filter id="ed-pgL" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.1" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="ed-pgB" x="-400%" y="-400%" width="900%" height="900%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              {/* Brilho do contorno das regiões (edge + edgeGlow no hover) */}
              <filter id="ed-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {MAP.regions.map(r => (
              <g key={r.key} className={cn('region', hot === r.key && 'hot')} transform={`translate(${DIR[r.key] * effSep},0)`}
                onMouseEnter={() => setHot(r.key)} onMouseLeave={() => setHot(h => (h === r.key ? null : h))}>
                <path className="fillHit" d={r.fill} />
                <path className="fill" d={r.fill} />
                <path className="lines" d={r.lines} />
                <path className="edge" d={r.fill} />
                <path className="edgeGlow" d={r.fill} />
                <text className="rlabel" x={r.lx} y={r.ly}>{r.name}</text>
              </g>
            ))}

            <g>
              {locations.flatMap(loc => {
                const bx = loc.x + DIR[loc.region] * effSep, by = loc.y
                // Tipos de ponto presentes (respeitando o filtro): cliente(verde), novo(roxo), lead(azul-céu).
                const kinds: { type: 'client' | 'novo' | 'lead'; n: number }[] = []
                if (filter !== 'leads' && loc.clients.length) kinds.push({ type: 'client', n: loc.clients.length })
                if (filter !== 'clientes' && loc.novos.length) kinds.push({ type: 'novo', n: loc.novos.length })
                if (filter !== 'clientes' && loc.leads.length) kinds.push({ type: 'lead', n: loc.leads.length })
                const mid = (kinds.length - 1) / 2
                const off = 10 / box.scale   // ~10px de espalhamento na tela entre pontos do mesmo local
                return kinds.map((k, i) => (
                  <Pin key={loc.key + k.type} type={k.type} x={bx + (i - mid) * off} y={by} n={k.n} scale={box.scale}
                    selected={sel?.loc.key === loc.key} onClick={e => openPanel(loc, e)} />
                ))
              })}
            </g>
          </svg>
          <div className="ed-map-vig" />
          {skin === 'holo' && <div className="ed-map-scan" />}
        </div>
        <p className="font-tech text-[10.5px] text-bento-muted text-center mt-3">Clique num ponto para ver clientes e leads.</p>

        {/* Popover ancorado (dentro de .ed-map p/ herdar as variáveis de tema) */}
        {sel && (
          <div className="ed-map-panel" style={sel.mobile ? { left: 8, right: 8, bottom: 10 } : { left: sel.left, top: sel.top }}>
            <button className="ed-map-x" onClick={() => setSel(null)} aria-label="Fechar">&#215;</button>
            <div className="ed-map-ph">
              <div className="ed-map-city">{sel.loc.city || sel.loc.st}<span className="ed-map-st">{sel.loc.st}</span></div>
              <div className="ed-map-badges">
                {sel.loc.code && <span className="ed-map-bdg">DDD {sel.loc.code}</span>}
                <span className="ed-map-bdg">{REGION_TZ[sel.loc.region]}</span>
              </div>
            </div>
            <div className="ed-map-pb">
              {sel.loc.clients.length > 0 && <PanelSection title="Clientes" cls="client" items={sel.loc.clients} />}
              {(sel.loc.novos.length + sel.loc.leads.length) > 0 && <PanelSection title="Leads" cls="lead" items={[...sel.loc.novos, ...sel.loc.leads]} />}
              {sel.loc.clients.length === 0 && sel.loc.novos.length === 0 && sel.loc.leads.length === 0 && <p className="ed-map-empty">Sem registros.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Counter({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <span className="font-tech text-[11px] text-bento-text border border-bento-border bg-bento-panel rounded-lg px-2.5 py-1.5 inline-flex items-baseline gap-1.5">
      <b className={cn('text-sm font-bold', cls)}>{value}</b>
      <span className="uppercase tracking-wider text-[9px] text-bento-muted">{label}</span>
    </span>
  )
}

function Pin({ type, x, y, n, scale, selected, onClick }: {
  type: 'client' | 'novo' | 'lead'; x: number; y: number; n: number; scale: number; selected: boolean; onClick: (e: MouseEvent) => void
}) {
  // Raios ~CONSTANTES na tela: px-alvo / escala (escala = larguraRenderizada/1000). Core cresce com n.
  const u = (px: number) => px / (scale || 1)
  return (
    <g className={cn('pin', type, selected && 'sel')} transform={`translate(${x},${y})`}
      role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onClick(e) }}>
      <circle className="halo" r={u(13)} />
      <circle className="selRing" r={u(9)} />
      <circle className="core" r={u(5 + Math.min(n - 1, 2))} />
      <circle className="hit" r={u(16)} />
    </g>
  )
}

function PanelSection({ title, cls, items }: { title: string; cls: 'client' | 'lead'; items: string[] }) {
  return (
    <div className="ed-map-sec">
      <div className={cn('ed-map-cap', cls)}>{title} · {items.length}</div>
      {items.map((nm, i) => (
        <div className="ed-map-cli" key={i}>
          <span className="ed-map-ix">{String(i + 1).padStart(2, '0')}</span>
          <span className={cn('ed-map-tk', cls)} />
          <span className="ed-map-nm">{nm}</span>
        </div>
      ))}
    </div>
  )
}
