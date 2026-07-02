import Link from 'next/link'
import {
  ChevronLeft, Building2, Phone, MessageSquare, ExternalLink, UserPlus, Wallet, CalendarDays,
  Clock, FileText, Sparkles, MessageCircle,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import type { LeadHubVM } from '@/lib/commercial/lead-hub-types'
import { LeadTimeline } from './LeadTimeline'
import { LeadPipeline } from './LeadPipeline'
import { LeadObservationComposer } from './LeadObservationComposer'

function usd(value: number | null): string {
  return value == null ? '—' : `US$ ${Number(value).toLocaleString('en-US')}`
}
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

// Hub do Lead — o centro da operação comercial. Mobile: coluna única (app-like). iPad/Desktop: contexto
// à esquerda + história à direita (lado a lado). Toda a lógica veio pronta do LeadHubService (ARCH-001).
export function LeadHub({ vm }: { vm: LeadHubVM }) {
  const stats = [
    { label: 'Dias como lead', value: vm.stats.daysAsLead },
    { label: 'Dias parado', value: vm.stats.daysStuck },
    { label: 'Contatos', value: vm.stats.contacts },
    { label: 'Reuniões', value: vm.stats.meetings },
    { label: 'Propostas', value: vm.stats.proposals },
    { label: 'Observações', value: vm.stats.observations },
    { label: 'Movimentações', value: vm.stats.movements },
    { label: 'Nicho', value: vm.nicho ?? '—' },
  ]
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
    <div className="space-y-6 md:space-y-7">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">
        {/* Contexto */}
        <div className="lg:col-span-1 space-y-4">
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

          <div>
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Estatísticas</p>
            <div className="grid grid-cols-2 gap-2.5">
              {stats.map(stat => (
                <div key={stat.label} className="bento-fx p-3">
                  <p className="font-display font-bold text-lg text-bento-text leading-none">{stat.value}</p>
                  <p className="text-[11px] text-bento-muted mt-1.5 truncate">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <Panel label="Pipeline"><LeadPipeline steps={vm.pipeline} /></Panel>

          <Panel label="Próxima ação">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">
                {vm.nextContact ? `Próximo contato em ${fmtDate(vm.nextContact)}.` : 'Sem próxima ação definida.'}{' '}
                Virará automação no AUTOMATION-001.
              </p>
            </div>
          </Panel>

          <Panel label="Arquivos">
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">
                Estrutura pronta (PDF, imagem, contrato, proposta, documento). Upload chega em breve.
              </p>
            </div>
          </Panel>

          <Panel label="Resumo IA">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">
                Resumo do lead, objeções, próxima melhor ação e resumo das reuniões — via AI Engine (AI-001).
              </p>
            </div>
          </Panel>
        </div>

        {/* História */}
        <div className="lg:col-span-2 space-y-4">
          <Panel label="Nova observação"><LeadObservationComposer leadId={vm.id} /></Panel>
          <Panel label="Timeline"><LeadTimeline items={vm.timeline} /></Panel>
          <Panel label="Comentários">
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
              <p className="text-[13px] text-bento-muted leading-relaxed">
                Comentários internos por contexto (estilo Notion, sem chat) chegam na próxima etapa, sobre esta timeline.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
