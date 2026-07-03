import { Panel } from '@/components/bento/Panel'
import { cn } from '@/lib/utils'

// Fontes de Lead (INBOUND-001, Part 7): mostra de ONDE os leads entram — visual apenas, reusável no Comercial
// e na Central de API. Não altera a criação de lead atual nem o Kanban. Só "Manual" está ativo hoje; as
// fontes externas caem no MESMO funil quando forem ativadas (via Webhooks de Entrada).
const LEAD_SOURCES: { name: string; active: boolean }[] = [
  { name: 'Manual', active: true },
  { name: 'Magnetic Funnels', active: false },
  { name: 'Meta Lead Ads', active: false },
  { name: 'Formulário próprio', active: false },
  { name: 'WhatsApp', active: false },
  { name: 'Webhook genérico', active: false },
]

export function LeadSourcesCard() {
  return (
    <Panel label="Fontes de Lead">
      <p className="text-[13px] text-bento-muted mb-3">
        Todo lead — manual ou de fonte externa — cai no <strong className="text-bento-text font-medium">mesmo funil</strong> do Comercial e aparece no Lead Hub.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {LEAD_SOURCES.map(s => (
          <div key={s.name} className="bento-fx p-3">
            <div className="flex items-center gap-2">
              <span className={cn('w-1.5 h-1.5 rounded-full flex-none', s.active ? 'bg-lime' : 'bg-bento-dim')} />
              <p className="text-sm font-medium text-bento-text truncate">{s.name}</p>
            </div>
            <p className="text-[11px] text-bento-muted mt-1">{s.active ? 'Ativo' : 'Aguardando ativação'}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
