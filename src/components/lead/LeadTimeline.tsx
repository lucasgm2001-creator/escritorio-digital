import {
  MessageSquare, TrendingUp, CalendarDays, Trophy, Clock, XCircle, FileText, UserPlus, MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadTimelineItem, LeadTimelineType } from '@/lib/commercial/lead-hub-types'

// Ícone + cor derivados do TIPO (a Timeline é universal: mistura observações, fases, reuniões, vendas...).
const MAP: Record<LeadTimelineType, { icon: LucideIcon; cls: string }> = {
  observacao:    { icon: MessageSquare, cls: 'text-amber-400 bg-amber-900/20 border-amber-800/40' },
  fase:          { icon: TrendingUp,    cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  reuniao:       { icon: CalendarDays,  cls: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
  no_show:       { icon: XCircle,       cls: 'text-red-400 bg-red-900/20 border-red-800/40' },
  reagendamento: { icon: CalendarDays,  cls: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
  proposta:      { icon: FileText,      cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  fechamento:    { icon: Trophy,        cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  perda:         { icon: XCircle,       cls: 'text-red-400 bg-red-900/20 border-red-800/40' },
  upgrade:       { icon: TrendingUp,    cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  renovacao:     { icon: TrendingUp,    cls: 'text-lime-fg bg-lime/10 border-lime/20' },
  responsavel:   { icon: UserPlus,      cls: 'text-bento-dim bg-bento-panel/60 border-bento-border' },
  arquivo:       { icon: FileText,      cls: 'text-bento-dim bg-bento-panel/60 border-bento-border' },
  comentario:    { icon: MessageCircle, cls: 'text-bento-dim bg-bento-panel/60 border-bento-border' },
  atividade:     { icon: Clock,         cls: 'text-bento-dim bg-bento-panel/60 border-bento-border' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function LeadTimeline({ items }: { items: LeadTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-bento-muted">Nenhum registro ainda. A primeira observação começa a história.</p>
  }
  return (
    <ol className="space-y-3">
      {items.map(item => {
        const { icon: Icon, cls } = MAP[item.type]
        return (
          <li key={item.id} className="flex gap-3">
            <div className={cn('w-8 h-8 rounded-bento border flex items-center justify-center shrink-0', cls)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-bento-text">{item.title}</span>
                {item.author && <span className="text-[11px] text-bento-muted truncate">· {item.author}</span>}
                <span className="text-[11px] text-bento-dim ml-auto shrink-0">{fmt(item.at)}</span>
              </div>
              {item.description && <p className="text-[13px] text-bento-muted mt-0.5 break-words">{item.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
