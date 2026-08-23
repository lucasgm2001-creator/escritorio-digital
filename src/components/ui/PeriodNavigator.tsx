'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rangeFor, shiftRange, canShift, isCurrentPeriod, type Mode, type Range } from '@/lib/period'

// Seletor de período com NAVEGAÇÃO (PERIODO-NAV-001). Um só componente para o Comercial › Métricas e para o
// Relatório da Minha Mesa — antes cada tela tinha a própria fileira de chips e só dava para ver o período
// CORRENTE: não havia como olhar o mês passado sem mexer em código.
//
// Três controles, nessa ordem de importância:
//  • setas ← → andam UMA unidade do período escolhido (mês → mês, semana → 7 dias, trimestre → 3 meses);
//  • os chips trocam a unidade e voltam para o período corrente;
//  • "Personalizar" abre de–até para qualquer janela.
// A seta de avançar trava no período corrente: relatório de mês futuro seria sempre zero.
// Toda data sai do rangeFor/shiftRange (lib/period) — nenhuma aritmética de calendário aqui.

const toYmd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fmtBR = (ymd: string): string => { const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}` }

export function PeriodNavigator({ range, onChange, modes, className }: {
  range: Range
  onChange: (r: Range) => void
  modes: [Mode, string][]
  className?: string
}) {
  const [customOpen, setCustomOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const shiftable = canShift(range.mode)
  const atCurrent = isCurrentPeriod(range)
  const invalid = !from || !to || from > to

  const selectMode = (m: Mode) => { setCustomOpen(false); onChange(rangeFor(m)) }
  const openCustom = () => { setFrom(toYmd(range.start)); setTo(toYmd(range.end)); setCustomOpen(v => !v) }
  const applyCustom = () => {
    if (invalid) return
    onChange({
      mode: 'custom',
      start: new Date(`${from}T00:00:00`),
      end: new Date(`${to}T23:59:59.999`),
      label: `de ${fmtBR(from)} a ${fmtBR(to)}`,
    })
    setCustomOpen(false)
  }

  return (
    <div className={cn('space-y-2 min-w-0', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Navegação: ← período → */}
        <div className="flex items-center gap-1 rounded-btn border border-bento-border bg-bento-bg p-1">
          <button type="button" onClick={() => onChange(shiftRange(range, -1))} disabled={!shiftable}
            aria-label="Período anterior"
            className="grid h-8 w-8 place-items-center rounded-[8px] text-bento-muted transition-colors hover:text-bento-text disabled:opacity-30 disabled:hover:text-bento-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 px-2 text-center font-tech text-xs text-bento-text truncate max-w-[16rem]" title={range.label}>
            {range.label}
          </span>
          <button type="button" onClick={() => onChange(shiftRange(range, 1))} disabled={!shiftable || atCurrent}
            aria-label="Próximo período"
            title={atCurrent ? 'Você já está no período atual' : undefined}
            className="grid h-8 w-8 place-items-center rounded-[8px] text-bento-muted transition-colors hover:text-bento-text disabled:opacity-30 disabled:hover:text-bento-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Unidade do período */}
        <div className="flex gap-1 rounded-btn border border-bento-border bg-bento-bg p-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {modes.map(([m, label]) => (
            <button key={m} type="button" onClick={() => selectMode(m)}
              className={cn('shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors',
                range.mode === m ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>

        <button type="button" onClick={openCustom} aria-expanded={customOpen}
          className={cn('inline-flex items-center gap-1.5 rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors',
            range.mode === 'custom' || customOpen
              ? 'border-lime bg-lime/10 text-lime-fg'
              : 'border-bento-border text-bento-muted hover:text-bento-text hover:border-lime/60')}>
          <CalendarRange className="h-3.5 w-3.5" /> Personalizar
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-btn border border-bento-border bg-bento-bg p-3">
          <label className="min-w-0">
            <span className="block font-tech text-[10px] uppercase tracking-label text-bento-muted">De</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="mt-1 rounded-btn border border-bento-border bg-bento-panel px-2.5 py-1.5 text-xs text-bento-text focus:border-lime focus:outline-none" />
          </label>
          <label className="min-w-0">
            <span className="block font-tech text-[10px] uppercase tracking-label text-bento-muted">Até</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="mt-1 rounded-btn border border-bento-border bg-bento-panel px-2.5 py-1.5 text-xs text-bento-text focus:border-lime focus:outline-none" />
          </label>
          <button type="button" onClick={applyCustom} disabled={invalid}
            className="bento-btn rounded-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            Aplicar
          </button>
          {invalid && from && to && <p className="text-[11px] text-amber-300">A data inicial precisa vir antes da final.</p>}
        </div>
      )}
    </div>
  )
}
