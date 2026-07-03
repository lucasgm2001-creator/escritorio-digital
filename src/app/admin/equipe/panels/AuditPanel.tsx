import { ScrollText, Info } from 'lucide-react'
import { eventsByCategory } from '@/lib/events/catalog'

// Aba AUDITORIA (Part 1 — preparação). NÃO registra nada ainda. Mostra, de forma honesta, os eventos de
// governança já CONTRATADOS no Event Bus (categoria 'workspace', TEAM-ADMIN-002 Part 7): o dia em que o
// runtime de auditoria existir, é isto que será gravado. Sem "em breve" vazio — é o contrato real.
export function AuditPanel() {
  const events = eventsByCategory('workspace')

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-bento border border-bento-border bg-bento-surface/40 p-4">
        <Info className="w-4 h-4 text-bento-dim shrink-0 mt-0.5" />
        <p className="text-[13px] text-bento-muted leading-relaxed">
          Auditoria <strong className="text-bento-text">em preparação</strong>. Os eventos abaixo já estão
          contratados no Event Bus; o registro histórico (quem fez o quê, quando) entra em uma etapa futura —
          nada é gravado agora.
        </p>
      </div>

      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.type} className="rounded-bento border border-bento-border bg-bento-surface/40 p-4 flex items-start gap-3">
            <ScrollText className="w-4 h-4 text-bento-dim shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-tech text-[13px] text-bento-text">{ev.type}</p>
              <p className="text-[12px] text-bento-muted mt-0.5 leading-relaxed">{ev.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
