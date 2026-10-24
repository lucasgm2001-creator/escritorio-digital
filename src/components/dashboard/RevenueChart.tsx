'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export type RevenueMonth = { key: string; label: string; value: number; partial: boolean }

// Receita recebida mês a mês (HALL-EMPRESA-001). Série ÚNICA → sem legenda (o título nomeia); cor da marca
// (lime) na barra, texto sempre em tokens de texto. Colunas finas (≤24px), topo arredondado e base reta,
// grade hairline recessiva, valor só no mês corrente (o resto vai no tooltip e na tabela para leitor de tela).
// O mês corrente é PARCIAL: um passo mais claro da mesma cor + "parcial" no rótulo — não compete com os fechados.
// HTML/CSS (não SVG com viewBox) para a largura da barra valer em pixels reais em qualquer tela.

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const compact = (n: number): string => (n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace('.0K', 'K') : String(Math.round(n)))

// Teto "redondo" do eixo (1 / 2 / 2,5 / 5 × 10^n) — ticks limpos (0 / 2,5K / 5K…).
function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

export function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const [active, setActive] = useState<string | null>(null)
  const top = niceMax(Math.max(0, ...months.map(m => m.value)))
  const ticks = [top, top / 2, 0]
  const yearOf = (key: string) => key.slice(0, 4)

  return (
    <div className="space-y-2">
      <div className="relative flex gap-2">
        {/* Eixo Y — 3 ticks compactos, texto muted. */}
        <div className="flex h-44 flex-col justify-between pb-5 text-right font-tech text-[10px] tabular-nums text-bento-muted" aria-hidden>
          {ticks.map(t => <span key={t} className="leading-none">{compact(t)}</span>)}
        </div>

        <div className="relative h-44 flex-1 min-w-0">
          {/* Grade hairline (1px, sólida, um passo fora da superfície). */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
            {ticks.map(t => <span key={t} className="h-px w-full bg-bento-border/70" />)}
          </div>

          <div className="absolute inset-x-0 top-0 bottom-0 flex">
            {months.map(m => {
              const h = top > 0 ? (m.value / top) * 100 : 0
              const isActive = active === m.key
              return (
                // Alvo de hover = a coluna inteira (maior que a barra). Foco por teclado mostra o mesmo tooltip.
                <div key={m.key} tabIndex={0}
                  onMouseEnter={() => setActive(m.key)} onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(m.key)} onBlur={() => setActive(null)}
                  aria-label={`${m.label} ${yearOf(m.key)}: ${usd(m.value)}${m.partial ? ' (parcial)' : ''}`}
                  className="group relative flex flex-1 min-w-0 flex-col items-center outline-none">
                  {/* Área da barra: o pb-5 reserva a faixa do rótulo do mês; % de altura vale sobre o resto. */}
                  <div className="relative flex w-full flex-1 items-end justify-center pb-5">
                    <div className="relative w-full max-w-[24px]" style={{ height: `${h}%`, minHeight: m.value > 0 ? 2 : 0 }}>
                      {/* Valor só no mês corrente (rótulo seletivo), preso ao topo da barra. */}
                      {m.partial && m.value > 0 && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-tech text-[10px] tabular-nums text-bento-dim whitespace-nowrap">
                          {compact(m.value)}
                        </span>
                      )}
                      <div className={cn('h-full w-full rounded-t-[4px] transition-opacity',
                        m.partial ? 'bg-lime/45' : 'bg-lime',
                        active && !isActive && 'opacity-50')} />
                    </div>
                  </div>
                  <span className={cn('absolute bottom-0 font-tech text-[10px] leading-5',
                    isActive ? 'text-bento-text' : 'text-bento-muted')}>{m.label}</span>

                  {isActive && (
                    <div role="tooltip"
                      className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-btn border border-bento-border bg-bento-panel px-2.5 py-1.5 shadow-card-hover">
                      <p className="font-tech text-[10px] text-bento-muted">{m.label} {yearOf(m.key)}{m.partial ? ' · parcial' : ''}</p>
                      <p className="text-note font-semibold tabular-nums text-bento-text">{usd(m.value)}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabela para leitor de tela — os mesmos números, sem depender de hover. */}
      <table className="sr-only">
        <caption>Receita recebida por mês</caption>
        <thead><tr><th>Mês</th><th>Receita recebida</th></tr></thead>
        <tbody>
          {months.map(m => (
            <tr key={m.key}><td>{m.label} {yearOf(m.key)}{m.partial ? ' (parcial)' : ''}</td><td>{usd(m.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
