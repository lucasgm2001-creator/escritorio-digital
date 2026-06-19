'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { cn, timeAgo } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { Newspaper, ExternalLink } from 'lucide-react'

interface News {
  id: string
  titulo: string
  categoria: string | null
  estados: string[]
  severidade: 'critico' | 'alta' | 'media'
  resumo: string | null
  impacto: string | null
  fonte_url: string | null
  fonte_nome: string | null
  published_at: string | null
  fetched_at: string
}

const NICHOS: { key: string; label: string }[] = [
  { key: 'licencas', label: 'Licenças' },
  { key: 'construcao', label: 'Construção' },
  { key: 'imigracao', label: 'Imigração' },
  { key: 'house_cleaning', label: 'House Cleaning' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'clima', label: 'Clima' },
]
const ESTADOS = ['MA', 'NJ', 'CA', 'NC', 'SC', 'US']
const RECENT_MS = 30 * 24 * 60 * 60 * 1000 // só mostra notícias dos últimos 30 dias

// Cor só com significado: crítico = vermelho, alta = âmbar, média = neutro.
const SEV: Record<string, { label: string; cls: string }> = {
  critico: { label: 'Crítico', cls: 'border-red-700/50 text-red-400' },
  alta:    { label: 'Alta',    cls: 'border-amber-700/50 text-amber-400' },
  media:   { label: 'Média',   cls: 'border-bento-border text-bento-muted' },
}

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000
let kicked = false // evita disparar o fallback várias vezes na mesma sessão (remounts)

export function NewsSection() {
  const [news, setNews] = useState<News[]>([])
  const [nicho, setNicho] = useState<string | null>(null)
  const [estado, setEstado] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('news').select('*').order('fetched_at', { ascending: false }).limit(60)
      .then(({ data }) => {
        const rows = (data ?? []) as News[]
        setNews(rows)
        // Fallback: se a última atualização passou de 12h (ou não há nada), dispara o refresh
        // em background — fire-and-forget, não trava a tela. Realtime injeta quando chegar.
        const last = rows[0]?.fetched_at ? new Date(rows[0].fetched_at).getTime() : 0
        if (!kicked && Date.now() - last > REFRESH_AFTER_MS) {
          kicked = true
          fetch('/api/news/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {})
        }
      })
  }, [])

  useRealtimeRows<News>('news', setNews)

  // Recentes primeiro (published_at DESC) e só dos últimos 30 dias; sem data fica por último mas aparece.
  const filtered = useMemo(() => {
    const now = Date.now()
    const ts = (n: News) => { const t = n.published_at ? Date.parse(n.published_at) : NaN; return Number.isNaN(t) ? 0 : t }
    return news
      .filter(n => (!nicho || n.categoria === nicho) && (!estado || (n.estados ?? []).includes(estado)))
      .filter(n => { const t = ts(n); return t === 0 ? true : (now - t) <= RECENT_MS })
      .sort((a, b) => ts(b) - ts(a))
  }, [news, nicho, estado])

  return (
    <Panel className="h-full" label="Notícias do setor" action={<Newspaper className="w-3.5 h-3.5 text-bento-muted" />}>
      {/* Filtros (client-side): nicho + estado */}
      <div className="flex flex-wrap items-center gap-1 mb-2.5">
        <Chip active={!nicho && !estado} onClick={() => { setNicho(null); setEstado(null) }}>Todas</Chip>
        {NICHOS.map(n => (
          <Chip key={n.key} active={nicho === n.key} onClick={() => setNicho(nicho === n.key ? null : n.key)}>{n.label}</Chip>
        ))}
        <span className="w-px h-4 bg-bento-border mx-1" />
        {ESTADOS.map(s => (
          <Chip key={s} active={estado === s} onClick={() => setEstado(estado === s ? null : s)}>{s}</Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-bento-muted py-6 text-center">
          {news.length === 0 ? 'Sem notícias ainda — a primeira atualização chega em breve.' : 'Nada com esse filtro.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 5).map(n => <NewsCard key={n.id} n={n} />)}
        </div>
      )}
    </Panel>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
        active ? 'bg-lime text-lime-ink border-lime' : 'border-bento-border text-bento-muted hover:text-bento-text')}>
      {children}
    </button>
  )
}

function NewsCard({ n }: { n: News }) {
  const [open, setOpen] = useState(false)
  const sev = SEV[n.severidade] ?? SEV.media
  const nichoLabel = NICHOS.find(x => x.key === n.categoria)?.label
  const hasDetail = !!(n.resumo || n.impacto)
  return (
    <div className="rounded-bento border border-bento-border bg-bento-panel p-2.5">
      {/* Enxuto: título + chips. Resumo/impacto só ao expandir (nada de parede de texto). */}
      <button type="button" onClick={() => hasDetail && setOpen(o => !o)} className={cn('w-full text-left', hasDetail && 'cursor-pointer')}>
        <p className="text-xs font-semibold text-bento-text leading-snug line-clamp-2">{n.titulo}</p>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {nichoLabel && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-bento-border text-bento-muted font-semibold">{nichoLabel}</span>}
          {(n.estados ?? []).slice(0, 2).map(e => (
            <span key={e} className="font-tech text-[10px] px-1.5 py-0.5 rounded-full border border-bento-border text-bento-dim">{e}</span>
          ))}
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-semibold', sev.cls)}>{sev.label}</span>
        </div>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {n.resumo && <p className="text-[11px] text-bento-dim leading-snug">{n.resumo}</p>}
          {n.impacto && <p className="text-[11px] text-bento-text leading-snug"><span className="text-bento-muted">Impacto:</span> {n.impacto}</p>}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        {n.fonte_url
          ? <a href={n.fonte_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-tech text-[10px] text-lime-fg hover:underline truncate">{n.fonte_nome || 'Fonte'}<ExternalLink className="w-3 h-3 flex-none" /></a>
          : <span className="font-tech text-[10px] text-bento-muted truncate">{n.fonte_nome || ''}</span>}
        <span className="flex items-center gap-1.5 flex-none">
          {hasDetail && <button type="button" onClick={() => setOpen(o => !o)} className="font-tech text-[10px] text-lime-fg hover:text-lime">{open ? 'menos' : 'ver mais'}</button>}
          <span className="font-tech text-[10px] text-bento-muted">{timeAgo(n.published_at || n.fetched_at)}</span>
        </span>
      </div>
    </div>
  )
}
