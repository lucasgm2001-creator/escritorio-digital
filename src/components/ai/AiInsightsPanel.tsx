import { Sparkles } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'

// Ponto de IA CONSOLIDADO (CRM-FINAL-001, Part 12). Um único componente para todos os lugares onde a IA
// aparecerá — lead, tráfego e o futuro perfil do cliente (resumo, objeções, sentimento, briefing, próxima
// melhor ação…). Sem IA real: apenas o placeholder elegante e padronizado.
export function AiInsightsPanel({
  label = 'Inteligência (IA)',
  items,
  note = 'Via AI Engine (AI-001).',
}: {
  label?: string
  items: string[]
  note?: string
}) {
  return (
    <Panel label={label}>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2 text-[13px] text-bento-muted">
            <Sparkles className="w-3.5 h-3.5 text-bento-dim shrink-0" /> {item}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-bento-dim mt-2">{note}</p>
    </Panel>
  )
}
