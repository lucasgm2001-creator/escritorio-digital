import { CalendarDays } from 'lucide-react'

// Agenda do Cliente — estrutura visual. Reuniões hoje são vinculadas ao LEAD (não ao cliente); quando
// houver fonte por cliente, entra aqui. Transparente por enquanto.
const KINDS = ['Reuniões', 'Follow-ups', 'Próximas datas', 'Eventos', 'Check-ins']

export default function ClientAgendaPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Agenda</h1>
        <p className="text-sm text-bento-muted">Reuniões, follow-ups e próximos eventos do cliente.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(kind => (
          <span key={kind} className="text-[12px] text-bento-muted border border-bento-border rounded-btn px-3 py-1.5">{kind}</span>
        ))}
      </div>

      <div className="bento-fx flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
        <div className="w-12 h-12 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center">
          <CalendarDays className="w-6 h-6 text-bento-dim" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-bento-text">Nenhum evento agendado</p>
          <p className="text-[13px] text-bento-muted max-w-sm mx-auto leading-relaxed">Reuniões e follow-ups do cliente aparecem aqui quando forem vinculados ao workspace.</p>
        </div>
      </div>
    </div>
  )
}
