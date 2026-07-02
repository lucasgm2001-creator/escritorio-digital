import Link from 'next/link'
import {
  ChevronLeft, Building2, Phone, MessageSquare, ExternalLink, UserPlus, Wallet, CalendarDays,
  Sparkles, FileText, MessageCircle,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import type { LeadHubVM } from '@/lib/commercial/lead-hub-types'
import { LeadTimeline } from './LeadTimeline'
import { LeadPipeline } from './LeadPipeline'
import { LeadHealthPanel } from './LeadHealthPanel'
import { LeadExecutivePanel } from './LeadExecutivePanel'
import { LeadJourney } from './LeadJourney'
import { LeadObservationComposer } from './LeadObservationComposer'

function usd(value: number | null): string {
  return value == null ? '—' : `US$ ${Number(value).toLocaleString('en-US')}`
}
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

const NEXT_ACTIONS = ['Ligar amanhã', 'Enviar proposta', 'Esperar retorno', 'Enviar contrato', 'Reagendar reunião', 'Marcar follow-up']
const AI_ITEMS = ['Resumo do lead', 'Últimas objeções', 'Resumo das reuniões', 'Próxima melhor ação', 'Sentimento do cliente', 'Resumo comercial']

// Hub do Lead — CRM profissional (LEAD-002). Executivo + jornada no topo (entender em 30s); depois
// contexto | história | painel lateral. Mobile: coluna única. Toda a lógica veio do LeadHubService.
export function LeadHub({ vm }: { vm: LeadHubVM }) {
  const info = [
    { icon: Building2, label: 'Empresa', value: vm.company ?? '—' },
    { icon: Phone, label: 'Telefone', value: vm.phone ?? '—' },
    { icon: MessageSquare, label: 'Email', value: vm.email ?? '—' },
    { icon: ExternalLink, label: 'Origem', value: vm.origem ?? '—' },
    { icon: UserPlus, label: 'Responsável', value: vm.responsavel ?? '—' },
    { icon: Wallet, label: 'Valor esperado', value: usd(vm.expectedValue) },
    { icon: CalendarDays, label: 'Próximo contato', value: fmtDate(vm.nextContact) },
  ]

  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] md:min-h-0">
        <ChevronLeft className="w-4 h-4" /> Comercial
      </Link>

      <header className="flex items-start gap-3 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-lg text-lime-fg">
          {vm.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text truncate">{vm.name}</h1>
            {vm.stageName && (
              <span className="text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border border-lime/30 bg-lime/10 text-lime-fg">
                {vm.stageName}
              </span>
            )}
          </div>
          <p className="text-sm text-bento-muted mt-1 truncate">
            {[vm.company, vm.responsavel && `Resp.: ${vm.responsavel}`].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </header>

      {/* Painel executivo + jornada — o "entenda em 30 segundos" */}
      <LeadExecutivePanel executive={vm.executive} />
      <Panel label="Jornada"><LeadJourney steps={vm.journey} /></Panel>

      {/* Contexto | História | Painel lateral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* Contexto */}
        <div className="md:col-span-1 lg:col-span-1 space-y-4">
          <Panel label="Resumo">
            <div className="space-y-2.5">
              {info.map(field => {
                const Icon = field.icon
                return (
                  <div key={field.label} className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-bento-dim shrink-0" />
                    <span className="text-[11px] text-bento-muted w-28 shrink-0">{field.label}</span>
                    <span className="text-sm text-bento-text truncate">{field.value}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
          <Panel label="Lead Health"><LeadHealthPanel health={vm.health} /></Panel>
        </div>

        {/* História (centro) */}
        <div className="md:col-span-1 lg:col-span-2 space-y-4">
          <Panel label="Nova observação"><LeadObservationComposer leadId={vm.id} /></Panel>
          <Panel label="Timeline"><LeadTimeline items={vm.timeline} /></Panel>
        </div>

        {/* Painel lateral */}
        <div className="md:col-span-2 lg:col-span-1 space-y-4">
          <Panel label="Histórico comercial"><LeadPipeline steps={vm.pipeline} /></Panel>

          <Panel label="Próximas ações">
            {vm.nextContact && <p className="text-[13px] text-bento-text mb-2">📅 Próximo contato: {fmtDate(vm.nextContact)}</p>}
            <div className="flex flex-wrap gap-2">
              {NEXT_ACTIONS.map(action => (
                <span key={action} className="text-[12px] px-2.5 py-1 rounded-btn border border-bento-border text-bento-muted">{action}</span>
              ))}
            </div>
            <p className="text-[11px] text-bento-dim mt-2">Vira automação no AUTOMATION-001.</p>
          </Panel>

          <Panel label="Inteligência (IA)">
            <div className="space-y-1.5">
              {AI_ITEMS.map(item => (
                <div key={item} className="flex items-center gap-2 text-[13px] text-bento-muted">
                  <Sparkles className="w-3.5 h-3.5 text-bento-dim shrink-0" /> {item}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-bento-dim mt-2">Via AI Engine (AI-001).</p>
          </Panel>

          <Panel label="Arquivos">
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">Estrutura pronta (PDF, imagem, contrato, proposta, documento). Upload em breve.</p>
            </div>
          </Panel>

          <Panel label="Comentários">
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">Comentários por contexto (estilo Notion) chegam com a migração aditiva de observações.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
