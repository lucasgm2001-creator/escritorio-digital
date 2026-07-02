import { Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { AdminBlueprint } from '@/lib/admin/sections'

// Visualização da estrutura OFICIAL (só apresentação — sem dados, sem regras).
// people:       Departamento → Cargo → Template → Colaborador
// compensation: Cargo → Template → Assignment → Ledger → Pagamento
const CHAINS: Record<AdminBlueprint, { t: string; c: string }[]> = {
  people: [
    { t: 'Departamento', c: 'a área (ex.: Comercial)' },
    { t: 'Cargo', c: 'o papel (ex.: Closer)' },
    { t: 'Template', c: 'as regras (ex.: Closer DR Growth)' },
    { t: 'Colaborador', c: 'a pessoa (ex.: Lucas)' },
  ],
  compensation: [
    { t: 'Cargo', c: 'define o papel' },
    { t: 'Template', c: 'as regras, versionado' },
    { t: 'Assignment', c: 'vínculo + vigência' },
    { t: 'Ledger', c: 'imutável, com snapshot' },
    { t: 'Pagamento', c: 'derivado do ledger' },
  ],
}

export function ModelBlueprint({ kind }: { kind: AdminBlueprint }) {
  const nodes = CHAINS[kind]
  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0">
      {nodes.map((node, i) => (
        <Fragment key={node.t}>
          <div className="flex-1 rounded-bento border border-bento-border bg-bento-panel/40 p-3">
            <p className="font-tech text-[10px] uppercase tracking-wide text-lime-fg">{`0${i + 1}`}</p>
            <p className="text-sm font-semibold text-bento-text mt-1">{node.t}</p>
            <p className="text-[11px] text-bento-muted mt-0.5">{node.c}</p>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex items-center justify-center text-bento-dim md:px-2">
              <ChevronDown className="w-4 h-4 md:hidden" />
              <ChevronRight className="hidden w-4 h-4 md:block" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
