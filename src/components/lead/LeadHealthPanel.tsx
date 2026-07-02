import type { LeadHealth } from '@/lib/commercial/lead-hub-types'

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

// Lead Health (LEAD-002): saúde do lead em cards.
export function LeadHealthPanel({ health }: { health: LeadHealth }) {
  const cards: { label: string; value: string | number }[] = [
    { label: 'Dias parado', value: health.daysStuck },
    { label: 'Tempo na fase', value: `${health.daysInStage}d` },
    { label: 'Último contato', value: fmtDate(health.lastContactAt) },
    { label: 'Última reunião', value: fmtDate(health.lastMeetingAt) },
    { label: 'Última proposta', value: fmtDate(health.lastProposalAt) },
    { label: 'Movimentações', value: health.movements },
    { label: 'Observações', value: health.observations },
    { label: 'Reuniões', value: health.meetings },
    { label: 'Propostas', value: health.proposals },
    { label: 'Contatos', value: health.contacts },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {cards.map(card => (
        <div key={card.label} className="bento-fx p-3">
          <p className="font-display font-bold text-base text-bento-text leading-none truncate">{card.value}</p>
          <p className="text-[11px] text-bento-muted mt-1.5 truncate">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
