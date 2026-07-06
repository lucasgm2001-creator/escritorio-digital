'use client'

import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import { ALL_COLUMNS } from '../types'
import { usdCompact as fmt } from '@/lib/format'
import type { Mode } from '@/lib/period'
import type { CommercialMetricsTabVM } from '@/core/metrics/types'
import { getCommercialMetricsTabAction } from '../metrics-actions'

// Aba Métricas — SÓ apresenta. Todos os KPIs/rankings/gráficos vêm do CommercialMetricsService (ARCH-001);
// nenhum acesso a Supabase e nenhum cálculo de regra aqui (só formatação e largura de barra).
const METRICAS_MODES: [Mode, string][] = [['semana', 'Esta semana'], ['mes', 'Este mês'], ['trimestre', 'Este trimestre'], ['tudo', 'Tudo']]
const STYLE_BY_KEY = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c])) as Record<string, (typeof ALL_COLUMNS)[number]>
const card = 'bento-fx p-5'
const pctFmt = (rate: number): string => `${(rate * 100).toFixed(0)}%`

export function MetricasTab() {
  const [mode, setMode] = useState<Mode>('mes')
  const [vm, setVm] = useState<CommercialMetricsTabVM | null>(null)

  useEffect(() => {
    let active = true
    getCommercialMetricsTabAction(mode).then(data => { if (active) setVm(data) })
    return () => { active = false }
  }, [mode])

  const KPIS: { label: string; value: string; sub: string; tone: MetricTone }[] = vm ? [
    { label: 'Recebidos',         value: String(vm.kpis.recebidos), sub: 'novos no período',                                       tone: 'default' },
    { label: 'Fechados',          value: String(vm.kpis.fechados),  sub: 'no período',                                             tone: 'positive' },
    { label: 'Taxa de Conversão', value: `${Math.round(vm.kpis.conversao)}%`, sub: 'leads que viraram cliente',                          tone: 'emerald' },
    { label: 'Pipeline',          value: fmt(vm.kpis.pipeline),     sub: 'ativos criados no período',                              tone: 'default' },
    { label: 'Ticket Médio',      value: fmt(vm.kpis.avgTicket),    sub: 'vendas no período',                                      tone: 'blue' },
    { label: 'Receita Fechada',   value: fmt(vm.kpis.closedValue),  sub: `${vm.kpis.fechados} no período`,                         tone: 'positive' },
  ] : []

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Seletor de período. Padrão = Este mês. O Service recalcula por período. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {METRICAS_MODES.map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
                mode === m ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>
        {vm && <p className="font-tech text-xs text-bento-muted">Período: <span className="text-bento-text font-semibold">{vm.periodLabel}</span></p>}
      </div>

      {!vm ? (
        <p className="text-sm text-bento-muted py-10 text-center">Carregando métricas…</p>
      ) : (
        <>
          {/* Topo: KPIs do PERÍODO */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {KPIS.map(kpi => (
              <MetricCard key={kpi.label} size="lg" tone={kpi.tone} title={kpi.label} value={kpi.value} subtitle={kpi.sub} />
            ))}
          </div>

          {/* Conversão Reunião → Venda (no período) */}
          <div className={`${card} flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4 flex-none" />
                <p className="text-xs font-medium">Conversão Reunião → Venda</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">{vm.fechouBase} de {vm.reuniaoBase} reuniões viraram venda</p>
            </div>
            <p className="font-display text-4xl font-bold tabular-nums text-lime-fg flex-none">{pctFmt(vm.convReuniao)}</p>
          </div>

          <p className="font-tech text-[11px] text-bento-muted">Estado atual do funil (não filtra por período):</p>

          {/* Meio: Funil por Etapa | Valor por Estágio | Receita por Vendedor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Funil por Etapa</h3>
              <div className="space-y-2.5">
                {vm.funnel.map(stage => {
                  const st = STYLE_BY_KEY[stage.key]
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-none ${st.dotColor}`} />
                          <span className="text-xs text-muted-foreground truncate">{st.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{stage.count}</span>
                      </div>
                      <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st.dotColor}`} style={{ width: `${(stage.count / vm.maxCount) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Estágio</h3>
              <div className="space-y-3">
                {vm.stageValues.map(stage => {
                  const st = STYLE_BY_KEY[stage.key]
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-none ${st.dotColor}`} />
                          <span className={`text-xs font-medium truncate ${st.textColor}`}>{st.label}</span>
                          <span className="text-[10px] text-muted-foreground flex-none">({stage.count})</span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(stage.value)}</span>
                      </div>
                      <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st.dotColor}`} style={{ width: `${(stage.value / vm.maxStageValue) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
                {vm.stageValues.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Receita por Vendedor <span className="font-tech text-[10px] text-muted-foreground">· no período</span></h3>
              <div className="space-y-3">
                {vm.bySeller.map(seller => (
                  <div key={seller.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-lime/15 flex items-center justify-center flex-none">
                          <span className="text-[9px] font-bold text-lime-fg">{seller.name.split(' ')[0]?.[0] ?? '?'}</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground truncate">{seller.name}</span>
                        <span className="text-[10px] text-muted-foreground flex-none">({seller.count})</span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(seller.value)}</span>
                    </div>
                    <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${(seller.value / vm.maxSellerValue) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {vm.bySeller.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
              </div>
            </div>
          </div>

          {/* Embaixo: Resumo | Temperatura */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Resumo</h3>
              <div className="flex justify-around">
                <div className="text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-foreground tabular-nums">{vm.snapshot.total}</p></div>
                <div className="text-center"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground tabular-nums">{vm.snapshot.ativos}</p></div>
                <div className="text-center"><p className="text-xs text-muted-foreground">Fechados</p><p className="text-lg font-bold text-lime-fg tabular-nums">{vm.snapshot.fechados}</p></div>
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Temperatura dos Leads</h3>
              <div className="space-y-3">
                {[
                  { label: 'Quente', count: vm.temperature.hot,  barClass: 'bg-orange-500', textClass: 'text-orange-400' },
                  { label: 'Morno',  count: vm.temperature.warm, barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
                  { label: 'Frio',   count: vm.temperature.cold, barClass: 'bg-slate-500',  textClass: 'text-slate-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.barClass}`} style={{ width: vm.snapshot.total > 0 ? `${(item.count / vm.snapshot.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
