import { cn } from '@/lib/utils'
import { LEAD_CATEGORIES } from '@/lib/commercial/lead-categories'
import type { LeadTimelineItem, LeadTimelineOrigin } from '@/lib/commercial/lead-hub-types'

// Timeline estilo HubSpot: trilho contínuo, nós por categoria, separadores por período, hierarquia clara.
const ORIGIN_LABEL: Record<LeadTimelineOrigin, string> = { manual: 'Manual', automacao: 'Automação', sistema: 'Sistema', ia: 'IA' }
const DAY = 86_400_000
const BUCKET_ORDER = ['Hoje', 'Ontem', 'Esta semana', 'Semana passada', 'Este mês', 'Meses anteriores']

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function bucketOf(iso: string | null): string {
  if (!iso) return 'Meses anteriores'
  const diff = Math.floor((startOfDay(Date.now()) - startOfDay(new Date(iso).getTime())) / DAY)
  if (diff <= 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff <= 6) return 'Esta semana'
  if (diff <= 13) return 'Semana passada'
  if (diff <= 31) return 'Este mês'
  return 'Meses anteriores'
}

function relative(iso: string | null): string {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24); if (d < 30) return `há ${d} d`
  const mo = Math.floor(d / 30); if (mo < 12) return `há ${mo} ${mo > 1 ? 'meses' : 'mês'}`
  return `há ${Math.floor(mo / 12)} ano(s)`
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function LeadTimeline({ items }: { items: LeadTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-bento-muted">Nenhum registro ainda. A primeira observação começa a história.</p>
  }

  // items já vêm do mais novo ao mais antigo → agrupamento preserva a ordem.
  const groups = new Map<string, LeadTimelineItem[]>()
  for (const item of items) {
    const bucket = bucketOf(item.at)
    const arr = groups.get(bucket) ?? []
    arr.push(item)
    groups.set(bucket, arr)
  }

  return (
    <div className="space-y-5">
      {BUCKET_ORDER.filter(b => groups.has(b)).map(bucket => (
        <div key={bucket}>
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2.5">{bucket}</p>
          <ol className="relative space-y-3">
            {/* trilho contínuo (HubSpot) */}
            <span className="absolute left-4 top-1 bottom-1 w-px bg-bento-border" aria-hidden />
            {(groups.get(bucket) ?? []).map(item => {
              const cat = LEAD_CATEGORIES[item.category]
              return (
                <li key={item.id} className="relative flex gap-3">
                  <div className={cn('relative z-10 w-8 h-8 rounded-bento border flex items-center justify-center shrink-0 text-sm', cat.cls)}>
                    <span aria-hidden>{cat.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1 rounded-bento border border-bento-border bg-bento-panel/30 px-3 py-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-bento-text">{item.title}</span>
                      <span className="text-[10px] font-tech uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-bento-border text-bento-dim">{cat.label}</span>
                      {item.author && <span className="text-[11px] text-bento-muted truncate">· {item.author}</span>}
                      <span className="text-[11px] text-bento-dim ml-auto shrink-0">{relative(item.at)}</span>
                    </div>
                    {item.description && <p className="text-[13px] text-bento-muted mt-1 break-words">{item.description}</p>}
                    <p className="text-[10px] text-bento-dim mt-1.5">{fmtWhen(item.at)} · {ORIGIN_LABEL[item.origin]}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
