import { Fragment } from 'react'
import { Briefcase, Wallet, UserPlus, FileText, TrendingUp, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'

// Fundação VISUAL da Compensation Engine (Cargo → Template → Assignment → Ledger → Pagamento).
// Componente reutilizável — sem cálculo, sem ledger, sem pagamentos. Só mostra como tudo se conecta.
const STAGES: { icon: LucideIcon; title: string; role: string; note: string }[] = [
  { icon: Briefcase, title: 'Cargo', role: 'o papel', note: 'Define a função (Closer, SDR...). Não é remuneração.' },
  { icon: Wallet, title: 'Template', role: 'as regras', note: 'Salário, comissões, limites e tetos — versionado.' },
  { icon: UserPlus, title: 'Assignment', role: 'o vínculo', note: 'Liga o colaborador ao template, com vigência.' },
  { icon: FileText, title: 'Ledger', role: 'o registro', note: 'Lançamentos imutáveis, com snapshot da regra.' },
  { icon: TrendingUp, title: 'Pagamento', role: 'o resultado', note: 'Derivado do ledger. Nunca recalcula o passado.' },
]

export function CompensationFlow() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon
          return (
            <Fragment key={stage.title}>
              <div className="flex-1 rounded-bento border border-bento-border bg-bento-panel/40 p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-lime-fg" />
                  </div>
                  <span className="font-tech text-[10px] uppercase tracking-wide text-bento-dim">{`0${i + 1}`}</span>
                </div>
                <p className="text-sm font-semibold text-bento-text">{stage.title}</p>
                <p className="text-[11px] text-lime-fg">{stage.role}</p>
                <p className="text-[11px] text-bento-muted leading-snug">{stage.note}</p>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex items-center justify-center text-bento-dim md:px-1.5">
                  <ChevronDown className="w-4 h-4 md:hidden" />
                  <ChevronRight className="hidden w-4 h-4 md:block" />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
      <p className="text-[11px] text-bento-dim leading-relaxed">
        Fluxo oficial da remuneração. Nesta fase é só a arquitetura visual — sem cálculo, sem ledger e sem
        pagamentos. A engine (COMPENSATION-001) plugará aqui sem alterar as telas.
      </p>
    </div>
  )
}
