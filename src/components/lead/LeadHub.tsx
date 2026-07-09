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
import { LeadObservationComposer } from './LeadObservationComposer'
import { LeadNotes } from './LeadNotes'
import { LeadAttachments } from './LeadAttachments'
import { LeadComments } from './LeadComments'
import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'
import { LeadTemperatureBadge } from './lead-temperature-ui'

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
  priority?: 'wide'
}

function ProfileFieldTile({ field }: { field: ProfileField }) {
  const Icon = field.icon

  return (
    <div className={cn(
      'min-w-0 rounded-btn border border-bento-border/70 bg-bento-panel/35 px-3 py-2.5',
      field.priority === 'wide' && 'sm:col-span-2',
    )}>
      <div className="flex items-center gap-2 text-[11px] text-bento-muted">
        <Icon className="h-4 w-4 shrink-0 text-bento-dim" aria-hidden />
        <span className="break-words">{field.label}</span>
      </div>
      <div className="mt-1 text-sm font-medium leading-snug text-bento-text break-words">
        {field.value}
      </div>
    </div>
  )
}

// Hub do Lead — CRM profissional (CRM-ULTIMATE-001). Saúde + executivo + jornada no topo (entender em
// 30s); depois contexto | história | painel lateral. Tudo veio do LeadHubService (ARCH-001).
export function LeadHub({ vm, embedded = false }: { vm: LeadHubVM; embedded?: boolean }) {
  const band = leadHealthBand(vm)

  const resumo = [
    { icon: Building2, label: 'Empresa', value: vm.company ?? '—' },
    { icon: Phone, label: 'Telefone', value: vm.phone ?? '—' },
    { icon: MessageSquare, label: 'Email', value: vm.email ?? '—' },
    { icon: ExternalLink, label: 'Origem', value: vm.origem ?? '—' },
    { icon: UserPlus, label: 'Responsável', value: vm.responsavel ?? '—' },
    { icon: Wallet, label: 'Valor esperado', value: usd(vm.expectedValue) },
    { icon: Activity, label: 'Temperatura', value: <LeadTemperatureBadge temperature={vm.executive.temperature} className="px-0 py-0 border-0 bg-transparent" /> },
    { icon: TrendingUp, label: 'Score', value: vm.executive.score != null ? String(vm.executive.score) : '—' },
    { icon: Trophy, label: 'Status', value: vm.stageName ?? '—' },
    { icon: CalendarDays, label: 'Dias como lead', value: `${vm.stats.daysAsLead}d` },
    { icon: Clock, label: 'Tempo na fase', value: `${vm.health.daysInStage}d` },
  ]

  const atividade = [
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
              <span className="text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border border-lime/30 bg-lime/10 text-lime-fg">
                {vm.stageName}
              </span>
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
          <span className={cn('w-1.5 h-1.5 rounded-full', band.dot)} /> Saúde: {band.label}
        </span>
      </header>

      {/* Painel executivo + jornada — o "entenda em 30 segundos" */}
      <LeadExecutivePanel executive={vm.executive} />
      <Panel label="Jornada"><LeadJourney steps={vm.journey} /></Panel>

      {/* Contexto | História | Painel lateral */}
      <div className="grid grid-cols-1 gap-4 items-start xl:grid-cols-12">
        {/* Contexto */}
        <div className="space-y-4 xl:col-span-5 2xl:col-span-3">
          <Panel label="Resumo">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-2.5">
              {resumo.map(field => <ProfileFieldTile key={field.label} field={field} />)}
            </div>
          </Panel>

          <Panel label="Atividade recente">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2.5">
              {atividade.map(field => <ProfileFieldTile key={field.label} field={field} />)}
            </div>
          </Panel>

          <Panel label="Lead Health"><LeadHealthPanel health={vm.health} /></Panel>
        </div>

        {/* História (centro) */}
        <div className="space-y-4 xl:col-span-7 2xl:col-span-6">
          <Panel label="Observações">
            <div className="space-y-3">
              <LeadObservationComposer leadId={vm.id} />
              <LeadNotes items={vm.timeline} />
            </div>
          </Panel>
          <Panel label="Timeline"><LeadTimeline items={vm.timeline} /></Panel>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4 xl:col-span-12 xl:grid xl:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] xl:gap-4 xl:space-y-0 2xl:col-span-3 2xl:block 2xl:space-y-4">
          <Panel label="Histórico comercial"><LeadPipeline steps={vm.pipeline} /></Panel>

          <Panel label="Próximas ações">
            <ul className="space-y-1.5">
              {NEXT_ACTIONS.map(action => {
                const Icon = action.icon
                return (
                  <li key={action.label} className="flex items-center gap-2.5 rounded-btn border border-bento-border px-2.5 py-2">
                    <Icon className="w-4 h-4 text-bento-dim shrink-0" />
                    <span className="text-[13px] text-bento-text">{action.label}</span>
                  </li>
                )
              })}
              {vm.nextContact && (
                <li className="flex items-center gap-2.5 rounded-btn border border-lime/25 bg-lime/10 px-2.5 py-2">
                  <CalendarDays className="w-4 h-4 text-lime-fg shrink-0" />
                  <span className="text-[13px] text-lime-fg">Próximo contato: {fmtDate(vm.nextContact)}</span>
                </li>
              )}
              {vm.health.daysStuck >= 5 && (
                <li className="flex items-center gap-2.5 rounded-btn border border-amber-700/40 bg-amber-900/20 px-2.5 py-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[13px] text-amber-300">Parado há {vm.health.daysStuck} dias</span>
                </li>
              )}
            </ul>
            <p className="text-[11px] text-bento-dim mt-2">Sugestões visuais — viram automação no AUTOMATION-001.</p>
          </Panel>

          <AiInsightsPanel items={AI_ITEMS} />

          <Panel label="Arquivos"><LeadAttachments /></Panel>
          <Panel label="Comentários"><LeadComments /></Panel>
        </div>
      </div>
    </div>
  )
}
