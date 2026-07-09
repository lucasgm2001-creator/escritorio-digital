import { LEAD_CATEGORIES } from '@/lib/commercial/lead-categories'
import type { LeadTimelineItem } from '@/lib/commercial/lead-hub-types'

// Observações estilo Notion: cartões elegantes com autor, data/hora e destaque — não parece textarea.
// Reusa os itens que o LeadHubService já traz na timeline (type='observacao'); sem estado paralelo.
function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function initials(name: string | null): string {
  if (!name) return '·'
  return name.trim().slice(0, 2).toUpperCase()
}

export function LeadNotes({ items }: { items: LeadTimelineItem[] }) {
  const notes = items.filter(item => item.type === 'observacao')
  if (notes.length === 0) {
    return <p className="text-sm text-bento-muted">Nenhuma observação ainda. A primeira começa a história do lead.</p>
  }

  return (
    <div className="space-y-2.5">
      {notes.map(note => {
        const cat = LEAD_CATEGORIES[note.category]
        return (
          <article key={note.id} className="rounded-bento border border-bento-border bg-bento-panel/40 p-3">
            <p className="text-[13px] text-bento-text leading-relaxed break-words whitespace-pre-wrap">
              {note.description || note.title}
            </p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="w-5 h-5 rounded-full bg-lime/15 text-lime-fg flex items-center justify-center text-[9px] font-bold shrink-0">
                {initials(note.author)}
              </span>
              <span className="text-[11px] text-bento-muted break-words">{note.author ?? 'Sistema'}</span>
              <span className="text-[10px] text-bento-dim ml-auto shrink-0">{fmtWhen(note.at)}</span>
              <span className={`text-[9px] font-tech uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${cat.cls}`}>{cat.label}</span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
