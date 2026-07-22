'use client'

import { cn } from '@/lib/utils'
import { rangeFor, type Mode, type Range } from '@/lib/period'

// Chips de período do Comercial (Funil + Contatos). MESMO visual da aba Métricas, pra ficar
// consistente. O default fica a cargo de quem detém o estado (Funil e Contatos usam 'tudo').
// Mobile: não estoura largura — rola na horizontal (scrollbar oculta) e cada chip é shrink-0.
const COMERCIAL_PERIODS: [Mode, string][] = [
  ['semana', 'Esta semana'], ['mes', 'Este mês'], ['trimestre', 'Este trimestre'], ['tudo', 'Tudo'],
]

export function PeriodChips({ range, onChange, className }: {
  range: Range
  onChange: (r: Range) => void
  className?: string
}) {
  return (
    <div className={cn('flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {COMERCIAL_PERIODS.map(([mode, label]) => (
        <button key={mode} type="button" onClick={() => onChange(rangeFor(mode))}
          className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
            range.mode === mode ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
          {label}
        </button>
      ))}
    </div>
  )
}
