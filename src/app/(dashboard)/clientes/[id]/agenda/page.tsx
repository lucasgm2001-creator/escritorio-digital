import { CalendarDays } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getClientAgenda, type ClientAgendaMeeting } from '@/server/services/ClientAgendaService'
import { AdminStat } from '@/components/admin/AdminStat'
import { Panel } from '@/components/bento/Panel'
import { formatDateBR } from '@/lib/date'

// Agenda do Cliente — dados REAIS (reuniões do lead de origem) via ClientAgendaService (ARCH-001).
function MeetingRow({ meeting }: { meeting: ClientAgendaMeeting }) {
  return (
    <div className="flex items-start gap-2.5">
      <CalendarDays className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-bento-text">{meeting.metOn ? formatDateBR(meeting.metOn) : '—'}</p>
        {meeting.note && <p className="text-[12px] text-bento-muted truncate">{meeting.note}</p>}
      </div>
    </div>
  )
}

export default async function ClientAgendaPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const agenda = context
    ? await getClientAgenda(context, params.id)
    : { counts: { hoje: 0, estaSemana: 0, proximos30: 0, concluidas: 0 }, proximas: [], concluidas: [] }

  const stats = [
    { label: 'Hoje', value: agenda.counts.hoje },
    { label: 'Esta semana', value: agenda.counts.estaSemana },
    { label: 'Próximos 30 dias', value: agenda.counts.proximos30 },
    { label: 'Concluídas', value: agenda.counts.concluidas },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Agenda</h1>
        <p className="text-sm text-bento-muted">Reuniões do cliente (dados internos) — próximas e concluídas.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map(stat => <AdminStat key={stat.label} label={stat.label} value={stat.value} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Próximas reuniões">
          {agenda.proximas.length === 0 ? (
            <p className="text-[13px] text-bento-muted">Nenhuma reunião futura agendada.</p>
          ) : (
            <div className="space-y-2.5">{agenda.proximas.map(meeting => <MeetingRow key={meeting.id} meeting={meeting} />)}</div>
          )}
        </Panel>

        <Panel label="Reuniões concluídas">
          {agenda.concluidas.length === 0 ? (
            <p className="text-[13px] text-bento-muted">Nenhuma reunião concluída ainda.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">{agenda.concluidas.map(meeting => <MeetingRow key={meeting.id} meeting={meeting} />)}</div>
          )}
        </Panel>
      </div>
    </div>
  )
}
