import { Building2, Phone, MessageSquare, UserPlus, CalendarDays, Clock, TrendingUp, Sparkles } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import { planLabel, type Client } from '@/app/(dashboard)/clientes/types'
import type { ClientFinanceVM } from '@/server/services/ClientFinanceService'
import type { ClientHealthBand } from '@/lib/client/health-band'

// Dashboard Executivo do Cliente (CLIENT-004) — só APRESENTA dados reais (identidade + Financeiro +
// última atividade + Saúde). Reusa MetricCard + Panel. O que não tem fonte fica como "—".
const DAY = 86_400_000
const usd = (value: number): string => formatCurrency(value, 'en-US', 'USD')
const dateOrDash = (iso: string | null | undefined): string => (iso ? formatDateBR(iso) : '—')
function contractAge(iso?: string | null): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  return days >= 0 ? `${days}d` : '—'
}

export function ClientResumo({ client, finance, lastActivityAt, health }: {
  client: Client
  finance: ClientFinanceVM
  lastActivityAt: string | null
  health: ClientHealthBand
}) {
  const daysSinceActivity = lastActivityAt ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / DAY) : null
  const proximaAcao = finance.semanasPendentes > 0 ? 'Cobrar semana(s) pendente(s)'
    : (daysSinceActivity != null && daysSinceActivity > 14) ? 'Fazer follow-up com o cliente'
    : finance.proximaCobranca ? 'Preparar próxima cobrança'
    : 'Acompanhar a entrega'

  const kpis: { title: string; value: string; tone?: MetricTone }[] = [
    { title: 'Plano', value: planLabel(client.plan_weekly) },
    { title: 'Total recebido', value: usd(finance.totalRecebido), tone: 'emerald' },
    { title: 'Semanas pagas', value: String(finance.semanasPagas), tone: 'positive' },
    { title: 'Semanas pendentes', value: String(finance.semanasPendentes), tone: finance.semanasPendentes > 0 ? 'negative' : 'default' },
  ]
  const info = [
    { icon: Building2, label: 'Empresa', value: client.company ?? client.name },
    { icon: UserPlus, label: 'Contato principal', value: client.name },
    { icon: Phone, label: 'Telefone', value: client.phone ?? '—' },
    { icon: MessageSquare, label: 'Email', value: client.email ?? '—' },
    { icon: UserPlus, label: 'Responsável', value: client.assigned_name ?? '—' },
    { icon: CalendarDays, label: 'Início do contrato', value: dateOrDash(client.start_date) },
  ]
  const activity = [
    { icon: Clock, label: 'Última atividade', value: dateOrDash(lastActivityAt) },
    { icon: CalendarDays, label: 'Próxima cobrança', value: finance.proximaCobranca ? `S${finance.proximaSemana} · ${dateOrDash(finance.proximaCobranca)}` : '—' },
    { icon: TrendingUp, label: 'Tempo de contrato', value: contractAge(client.start_date) },
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
        <span title={health.hint} className={cn('inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0', health.cls)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', health.dot)} /> Saúde: {health.label}
        </span>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(kpi => <MetricCard key={kpi.title} title={kpi.title} value={kpi.value} tone={kpi.tone} size="lg" />)}
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

        <div className="space-y-4">
          <Panel label="Atividade">
            <div className="space-y-2.5">
              {activity.map(field => {
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

          <Panel label="Próxima ação">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-lime-fg shrink-0" />
              <span className="text-sm text-bento-text">{proximaAcao}</span>
            </div>
            <p className="text-[11px] text-bento-dim mt-2">{health.hint} · sugestão derivada dos dados reais.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
