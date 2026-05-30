'use client'

import type { Lead } from '../types'

interface Props { leads: Lead[] }

function fmt(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  if (v > 0)          return `R$ ${v.toLocaleString('pt-BR')}`
  return 'R$ 0'
}

const FUNNEL_STAGES = [
  { key: 'novo',      label: 'Novo Lead',   dotClass: 'bg-blue-500' },
  { key: 'interagiu', label: 'Interagiu',   dotClass: 'bg-indigo-500' },
  { key: 'reuniao',   label: 'Reunião',     dotClass: 'bg-purple-500' },
  { key: 'proposta',  label: 'Proposta',    dotClass: 'bg-amber-500' },
  { key: 'fechado',   label: 'Venda Feita', dotClass: 'bg-emerald-500' },
]

const card = 'bg-[#161b22] rounded-xl border border-[#2d3748] p-5'

export function MetricasTab({ leads }: Props) {
  const total    = leads.length
  const fechados = leads.filter(l => l.status === 'fechado').length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const brasil   = leads.filter(l => l.operation === 'brasil').length
  const eua      = leads.filter(l => l.operation === 'eua').length

  const closedValue = leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.value || 0), 0)
  const avgTicket   = fechados > 0 ? closedValue / fechados : 0
  const convRate    = total > 0 ? (fechados / total) * 100 : 0
  const lossRate    = total > 0 ? (perdidos / total) * 100 : 0

  const hot  = leads.filter(l => l.score > 650).length
  const warm = leads.filter(l => l.score > 400 && l.score <= 650).length
  const cold = leads.filter(l => l.score <= 400).length

  const maxCount = Math.max(...FUNNEL_STAGES.map(s => leads.filter(l => l.status === s.key).length), 1)

  return (
    <div className="p-6 space-y-5 overflow-auto h-full bg-background">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Taxa de Conversão', value: `${convRate.toFixed(1)}%`,  sub: `${fechados} de ${total} leads`, valueClass: 'text-emerald-400', accent: 'before:bg-emerald-500' },
          { label: 'Taxa de Perda',     value: `${lossRate.toFixed(1)}%`,  sub: `${perdidos} perdidos`,          valueClass: 'text-rose-400',    accent: 'before:bg-rose-500' },
          { label: 'Ticket Médio',      value: fmt(avgTicket),             sub: 'vendas fechadas',               valueClass: 'text-blue-400',    accent: 'before:bg-blue-500' },
          { label: 'Receita Fechada',   value: fmt(closedValue),           sub: `${fechados} contratos`,         valueClass: 'text-primary-400', accent: 'before:bg-primary-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`stat-card ${kpi.accent}`}>
            <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${kpi.valueClass}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Funil */}
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Funil por Etapa</h3>
          <div className="space-y-2.5">
            {FUNNEL_STAGES.map(stage => {
              const count = leads.filter(l => l.status === stage.key).length
              const pct   = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${stage.dotClass}`} />
                      <span className="text-xs text-muted-foreground">{stage.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${stage.dotClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Origem */}
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Leads por Origem</h3>
          <div className="space-y-3">
            {[
              { label: 'Brasil', count: brasil, barClass: 'bg-green-500' },
              { label: 'EUA',    count: eua,    barClass: 'bg-blue-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {total > 0 ? `${((item.count / total) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${item.barClass}`}
                    style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="mt-4 pt-3 border-t border-[#2d3748] flex justify-around">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{total}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-lg font-bold text-foreground">
                  {leads.filter(l => l.status !== 'fechado' && l.status !== 'perdido').length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Temperatura */}
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Temperatura dos Leads</h3>
          <div className="space-y-3">
            {[
              { label: 'Quente / Fechando', count: hot,  barClass: 'bg-orange-500', textClass: 'text-orange-400' },
              { label: 'Morno / Frio',      count: warm, barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
              { label: 'Muito Frio',        count: cold, barClass: 'bg-slate-500',  textClass: 'text-slate-400' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                </div>
                <div className="h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${item.barClass}`}
                    style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="mt-4 pt-3 border-t border-[#2d3748] grid grid-cols-3 gap-1 text-center">
              {[
                { v: hot,  label: 'Quentes', cls: 'text-orange-400' },
                { v: warm, label: 'Mornos',  cls: 'text-yellow-400' },
                { v: cold, label: 'Frios',   cls: 'text-slate-400' },
              ].map(item => (
                <div key={item.label}>
                  <p className={`text-base font-bold ${item.cls}`}>{item.v}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
