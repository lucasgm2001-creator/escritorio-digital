import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ChevronLeft, Building2, Phone, MessageSquare, ExternalLink, UserPlus, Wallet, CalendarDays,
  Activity, FileText, Clock, TrendingUp, Trophy, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import type { LeadHubVM } from '@/lib/commercial/lead-hub-types'
import { leadHealthBand } from '@/lib/commercial/lead-health-band'
import { LeadTimeline } from './LeadTimeline'
import { LeadPipeline } from './LeadPipeline'
import { LeadHealthPanel } from './LeadHealthPanel'
import { LeadExecutivePanel } from './LeadExecutivePanel'
import { LeadJourney } from './LeadJourney'
import { LeadAttachments } from './LeadAttachments'
import { LeadComments } from './LeadComments'
import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'
import { ActionIcon, HealthIndicator, LeadStatusBadge, LeadTemperatureBadge } from './lead-profile-primitives'
import { LeadProfileTabs } from './LeadProfileTabs'

function usd(value: number | null): string {
  return value == null ? '—' : `US$ ${Number(value).toLocaleString('en-US')}`
}
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

const NEXT_ACTIONS = [
  { icon: Phone, label: 'Ligar amanhã' },
  { icon: FileText, label: 'Enviar proposta' },
  { icon: CalendarDays, label: 'Agendar reunião' },
  { icon: MessageSquare, label: 'Fazer follow-up' },
]
const AI_ITEMS = ['Resumo do lead', 'Últimas objeções', 'Resumo das reuniões', 'Próxima melhor ação', 'Sentimento do cliente', 'Resumo comercial']

type ProfileField = {
  icon: LucideIcon
  label: string
  value: ReactNode
  priority?: 'hero' | 'wide'
}

function ProfileFieldTile({ field }: { field: ProfileField }) {
  const Icon = field.icon

  return (
    <div className={cn(
      'min-w-0 min-h-[5.5rem] rounded-btn border border-bento-border/70 bg-bento-panel/35 p-3',
      field.priority === 'hero' && 'sm:col-span-2',
      field.priority === 'wide' && 'sm:col-span-2',
    )}>
      <div className="flex min-w-0 items-center gap-2.5 text-[11px] text-bento-muted">
        <ActionIcon icon={Icon} className="h-7 w-7 rounded-[7px] border-transparent bg-bento-bg/40" />
        <span className="min-w-0 break-words leading-snug">{field.label}</span>
      </div>
      <div className={cn('mt-1 leading-snug text-bento-text break-words', field.priority === 'hero' ? 'text-base font-semibold' : 'text-sm font-medium')}>
        {field.value}
      </div>
    </div>
  )
}

// Hub do Lead — CRM profissional (CRM-ULTIMATE-001). Saúde + executivo + jornada no topo (entender em
// 30s); depois contexto | história | painel lateral. Tudo veio do LeadHubService (ARCH-001).
export function LeadHub({ vm, embedded = false }: { vm: LeadHubVM; embedded?: boolean }) {
  const band = leadHealthBand(vm)

  const resumo: ProfileField[] = [
    { icon: Building2, label: 'Empresa', value: vm.company ?? '—', priority: 'hero' },
    { icon: Phone, label: 'Telefone', value: vm.phone ?? '—', priority: 'hero' },
    { icon: MessageSquare, label: 'Email', value: vm.email ?? '—', priority: 'wide' },
    { icon: ExternalLink, label: 'Origem', value: vm.origem ?? '—' },
    { icon: UserPlus, label: 'Responsável', value: vm.responsavel ?? '—', priority: 'wide' },
    { icon: Wallet, label: 'Valor esperado', value: usd(vm.expectedValue) },
    { icon: Activity, label: 'Temperatura', value: <LeadTemperatureBadge temperature={vm.executive.temperature} className="px-0 py-0 border-0 bg-transparent text-sm" />, priority: 'wide' },
    { icon: TrendingUp, label: 'Score', value: vm.executive.score != null ? String(vm.executive.score) : '—' },
    { icon: Trophy, label: 'Status', value: vm.stageName ? <LeadStatusBadge className="px-0 py-0 border-0 bg-transparent text-sm normal-case tracking-normal">{vm.stageName}</LeadStatusBadge> : '—', priority: 'wide' },
    { icon: CalendarDays, label: 'Dias como lead', value: `${vm.stats.daysAsLead}d` },
    { icon: Clock, label: 'Tempo na fase', value: `${vm.health.daysInStage}d` },
  ]

  const atividade: ProfileField[] = [
    { icon: Phone, label: 'Último contato', value: fmtDate(vm.health.lastContactAt) },
    { icon: CalendarDays, label: 'Última reunião', value: fmtDate(vm.health.lastMeetingAt) },
    { icon: FileText, label: 'Última proposta', value: fmtDate(vm.health.lastProposalAt) },
    { icon: TrendingUp, label: 'Última movimentação', value: fmtDate(vm.stageChangedAt) },
    { icon: Clock, label: 'Próxima ação', value: fmtDate(vm.nextContact) },
  ]

  return (
    <div className="space-y-5 md:space-y-6">
      {!embedded && (
        <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] md:min-h-0">
          <ChevronLeft className="w-4 h-4" /> Comercial
        </Link>
      )}

      <header className="flex items-start gap-3 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-lg text-lime-fg">
          {vm.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text break-words">{vm.name}</h1>
            {vm.stageName && (
              <LeadStatusBadge>{vm.stageName}</LeadStatusBadge>
            )}
          </div>
          <p className="text-sm text-bento-muted mt-1 break-words">
            {[vm.company, vm.responsavel && `Resp.: ${vm.responsavel}`].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <span
          title={band.hint}
          className={cn('inline-flex items-center gap-1.5 text-[11px] font-tech uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0', band.cls)}
        >
          <HealthIndicator className={band.dot} /> Saúde: {band.label}
        </span>
      </header>

      <LeadProfileTabs leadId={vm.id} active="overview" />

      {/* Painel executivo + jornada — o "entenda em 30 segundos" */}
      <LeadExecutivePanel executive={vm.executive} />
      <Panel label="Jornada"><LeadJourney steps={vm.journey} /></Panel>

      {/* Contexto | História | Painel lateral */}
      <div className="grid grid-cols-1 gap-4 items-start xl:grid-cols-12">
        {/* Contexto */}
        <div className="space-y-4 xl:col-span-5 2xl:col-span-3">
          <Panel label="Resumo">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {resumo.map(field => <ProfileFieldTile key={field.label} field={field} />)}
            </div>
          </Panel>

          <Panel label="Atividade recente">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {atividade.map(field => <ProfileFieldTile key={field.label} field={field} />)}
            </div>
          </Panel>

          <Panel label="Lead Health"><LeadHealthPanel health={vm.health} /></Panel>
        </div>

        {/* Notebook: história + complementos formam uma coluna contínua (sem o grande vazio provocado
            por uma segunda linha do grid). Desktop largo: `contents` devolve história e lateral como
            colunas independentes 6/3, ao lado do contexto 3. */}
        <div className="space-y-4 xl:col-span-7 2xl:contents 2xl:space-y-0">
          {/* História (centro) */}
          <div className="space-y-4 2xl:col-span-6">
            <Panel label="Timeline"><LeadTimeline items={vm.timeline} /></Panel>
          </div>

          {/* Painel lateral */}
          <div className="space-y-4 xl:grid xl:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] xl:gap-4 xl:space-y-0 2xl:col-span-3 2xl:block 2xl:space-y-4">
            <Panel label="Histórico comercial"><LeadPipeline steps={vm.pipeline} /></Panel>

            <Panel label="Próximas ações">
              <ul className="space-y-1.5">
                {NEXT_ACTIONS.map(action => {
                  const Icon = action.icon
                  return (
                    <li key={action.label} className="flex items-center gap-2.5 rounded-btn border border-bento-border px-2.5 py-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-bento-dim shrink-0" />
                      <span className="min-w-0 text-[13px] text-bento-text break-words">{action.label}</span>
                    </li>
                  )
                })}
                {vm.nextContact && (
                  <li className="flex items-center gap-2.5 rounded-btn border border-lime/25 bg-lime/10 px-2.5 py-2.5 min-w-0">
                    <CalendarDays className="w-4 h-4 text-lime-fg shrink-0" />
                    <span className="min-w-0 text-[13px] text-lime-fg break-words">Próximo contato: {fmtDate(vm.nextContact)}</span>
                  </li>
                )}
                {vm.health.daysStuck >= 5 && (
                  <li className="flex items-center gap-2.5 rounded-btn border border-amber-700/40 bg-amber-900/20 px-2.5 py-2.5 min-w-0">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="min-w-0 text-[13px] text-amber-300 break-words">Parado há {vm.health.daysStuck} dias</span>
                  </li>
                )}
              </ul>
              <p className="text-[11px] text-bento-dim mt-2 break-words">Sugestões visuais — viram automação no AUTOMATION-001.</p>
            </Panel>

            <AiInsightsPanel items={AI_ITEMS} />

            <Panel label="Arquivos"><LeadAttachments /></Panel>
            <Panel label="Comentários"><LeadComments /></Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
