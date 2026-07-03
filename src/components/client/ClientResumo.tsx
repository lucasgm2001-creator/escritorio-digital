import { Building2, Phone, MessageSquare, UserPlus, CalendarDays, TrendingUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { MetricCard } from '@/components/ui/MetricCard'
import { planLabel, healthOf, type Client } from '@/app/(dashboard)/clientes/types'

// Dashboard Executivo do Cliente (CLIENT-001, Parte 2). Reusa Panel + MetricCard + healthOf + planLabel.
// Campos reais do cadastro; o que ainda não tem fonte (reunião/relatório/campanha) fica como estrutura ("—").
function fmtDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}
function contractAge(iso?: string | null): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days >= 0 ? `${days}d` : '—'
}

export function ClientResumo({ client }: { client: Client }) {
  const health = healthOf(client.status)

  const kpis = [
    { title: 'Plano', value: planLabel(client.plan_weekly) },
    { title: 'Status', value: health.label },
    { title: 'Tempo de contrato', value: contractAge(client.start_date) },
    { title: 'Responsável', value: client.assigned_name ?? '—' },
  ]
  const info = [
    { icon: Building2, label: 'Empresa', value: client.company ?? client.name },
    { icon: UserPlus, label: 'Contato principal', value: client.name },
    { icon: Phone, label: 'Telefone', value: client.phone ?? '—' },
    { icon: MessageSquare, label: 'Email', value: client.email ?? '—' },
    { icon: UserPlus, label: 'Responsável', value: client.assigned_name ?? '—' },
    { icon: CalendarDays, label: 'Início do contrato', value: fmtDate(client.start_date) },
  ]
  const recent = [
    { icon: CalendarDays, label: 'Última reunião', value: '—' },
    { icon: FileText, label: 'Último relatório', value: '—' },
    { icon: TrendingUp, label: 'Última campanha', value: '—' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-lg text-lime-fg">
          {client.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-2xl text-bento-text truncate">{client.name}</h1>
          <p className="text-sm text-bento-muted mt-0.5 truncate">{[client.company, client.nicho].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wide px-2.5 py-1 rounded-full border border-bento-border text-bento-text shrink-0">
          <span className={cn('w-1.5 h-1.5 rounded-full', health.dot)} /> Saúde: {health.label}
        </span>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(kpi => <MetricCard key={kpi.title} title={kpi.title} value={kpi.value} size="lg" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Resumo">
          <div className="space-y-2.5">
            {info.map(field => {
              const Icon = field.icon
              return (
                <div key={field.label} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-bento-dim shrink-0" />
                  <span className="text-[11px] text-bento-muted w-32 shrink-0">{field.label}</span>
                  <span className="text-sm text-bento-text truncate">{field.value}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel label="Atividade recente">
          <div className="space-y-2.5">
            {recent.map(field => {
              const Icon = field.icon
              return (
                <div key={field.label} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-bento-dim shrink-0" />
                  <span className="text-[11px] text-bento-muted w-32 shrink-0">{field.label}</span>
                  <span className="text-sm text-bento-text truncate">{field.value}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-bento-dim mt-3">Reunião, relatório e campanha aparecem quando as abas correspondentes forem conectadas.</p>
        </Panel>
      </div>
    </div>
  )
}
