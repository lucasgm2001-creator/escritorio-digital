'use client'

// /design-system — Storybook INTERNO (DESIGN-SYSTEM-2.0). Referência visual viva: renderiza os tokens e
// componentes oficiais do DESIGN_SYSTEM_SPEC.md lado a lado, usando as classes canônicas. Rota autenticada
// (dev/equipe), sem entrada no menu, SEM dados/queries/lógica — só apresentação. NÃO migra nenhuma tela.

import { useState } from 'react'
import { ChevronDown, Wallet, TrendingUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import { EmptyState } from '@/components/ui/EmptyState'

// Rótulo de seção canônico (tokens novos: text-label + tracking-label).
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-tech text-label uppercase tracking-label text-bento-muted">{children}</p>
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Eyebrow>{title}</Eyebrow>
        <span className="h-px flex-1 bg-bento-border/60" />
      </div>
      {children}
    </section>
  )
}
function Swatch({ cls, name }: { cls: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn('h-12 rounded-bento border border-bento-border', cls)} />
      <span className="text-caption text-bento-dim">{name}</span>
    </div>
  )
}

const TONES: MetricTone[] = ['default', 'positive', 'negative', 'muted', 'emerald', 'blue', 'warning']

export default function DesignSystemPage() {
  const [open, setOpen] = useState(true)

  return (
    <div className="p-4 sm:p-6 mx-auto w-full max-w-6xl space-y-8 font-body">
      {/* Header */}
      <header className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 text-caption text-lime-fg">● referência interna</span>
        <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Design System — Bento Compacto</h1>
        <p className="text-sm text-bento-muted">Fonte visual viva. Espelha <code className="text-note text-bento-dim">docs/DESIGN_SYSTEM_SPEC.md</code>. Toda tela nova usa daqui.</p>
      </header>

      {/* Cores */}
      <Block title="Cores · superfície & texto">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <Swatch cls="bg-bento-bg" name="bento-bg" />
          <Swatch cls="bg-bento-panel" name="bento-panel" />
          <Swatch cls="bg-bento-surface" name="bento-surface" />
          <Swatch cls="bg-bento-border" name="bento-border" />
          <Swatch cls="bg-bento-text" name="bento-text" />
          <Swatch cls="bg-bento-muted" name="bento-muted" />
        </div>
      </Block>
      <Block title="Cores · acento & semântica">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <Swatch cls="bg-lime" name="lime (acento)" />
          <Swatch cls="bg-lime-soft" name="lime-soft" />
          <Swatch cls="bg-success" name="success" />
          <Swatch cls="bg-warning" name="warning" />
          <Swatch cls="bg-destructive" name="destructive" />
          <Swatch cls="bg-blue-400" name="info (blue)" />
        </div>
      </Block>

      {/* Raio + Sombra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Block title="Raio (tokens)">
          <div className="flex flex-wrap gap-4">
            {[['rounded-btn', '10 · botão'], ['rounded-bento', '14 · card'], ['rounded-frame', '22 · superfície'], ['rounded-full', '∞ · pill']].map(([r, l]) => (
              <div key={r} className="flex flex-col items-center gap-1.5">
                <div className={cn('w-16 h-16 bg-bento-panel border border-bento-border', r)} />
                <span className="text-caption text-bento-dim">{l}</span>
              </div>
            ))}
          </div>
        </Block>
        <Block title="Sombra (tokens)">
          <div className="flex flex-wrap gap-5 pt-1">
            {['shadow-card', 'shadow-card-hover', 'shadow-glow-sm'].map(s => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <div className={cn('w-20 h-14 rounded-bento bg-bento-panel border border-bento-border', s)} />
                <span className="text-caption text-bento-dim">{s}</span>
              </div>
            ))}
          </div>
        </Block>
      </div>

      {/* Tipografia */}
      <Block title="Escala tipográfica">
        <div className="bento-fx p-5 space-y-2">
          <p className="font-display text-4xl font-bold text-bento-text tabular-nums leading-none">US$ 887,50</p>
          <p className="font-display text-2xl font-bold text-bento-text">Título de página (2xl · display · bold)</p>
          <p className="text-base text-bento-text">Corpo grande — text-base</p>
          <p className="text-sm text-bento-text">Corpo padrão — text-sm</p>
          <p className="text-note text-bento-dim">Apoio pequeno — text-note (13)</p>
          <p className="text-caption text-bento-muted">Legenda / meta — text-caption (11)</p>
          <p className="font-tech text-label uppercase tracking-label text-bento-muted">Rótulo de seção — text-label (10)</p>
        </div>
      </Block>

      {/* Botões + alturas */}
      <Block title="Botões (alturas: control / control-sm)">
        <div className="flex flex-wrap items-center gap-3">
          <button className="bento-btn rounded-btn px-4 min-h-control text-sm font-semibold">Primário</button>
          <button className="border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg rounded-btn px-4 min-h-control text-sm font-medium transition-colors">Secundário</button>
          <button className="text-bento-muted hover:text-bento-text rounded-btn px-3 min-h-control-sm text-sm transition-colors">Ghost</button>
          <button className="bg-red-500/90 hover:bg-red-500 text-white rounded-btn px-4 min-h-control text-sm font-semibold transition-colors">Destrutivo</button>
          <button disabled className="bento-btn rounded-btn px-4 min-h-control text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Disabled</button>
        </div>
      </Block>

      {/* Inputs */}
      <Block title="Inputs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <input placeholder="Input padrão (min-h-control)" className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 min-h-control text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
          <select className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 min-h-control text-sm text-bento-text focus:outline-none focus:border-lime">
            <option>Select</option>
          </select>
        </div>
      </Block>

      {/* Badges */}
      <Block title="Badges / chips">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-bento-border text-bento-muted rounded-full text-caption px-2 py-0.5">Neutro</span>
          <span className="border border-lime/30 text-lime-fg bg-lime/10 rounded-full text-caption px-2 py-0.5 inline-flex items-center gap-1"><Check className="w-3 h-3" />Sucesso</span>
          <span className="border border-amber-500/40 text-amber-400 bg-amber-900/30 rounded-full text-caption px-2 py-0.5">Atenção</span>
          <span className="border border-red-400/40 text-red-400 bg-red-400/10 rounded-full text-caption px-2 py-0.5">Perigo</span>
        </div>
      </Block>

      {/* MetricCard tones + sizes */}
      <Block title="MetricCard · tones">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {TONES.map(t => <MetricCard key={t} title={t} value="US$ 6.230" size="sm" tone={t} />)}
        </div>
      </Block>
      <Block title="MetricCard · sizes + trend + interativo">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard title="size sm" value="11" size="sm" subtitle="clientes ativos" />
          <MetricCard title="size md" value="US$ 6.230" size="md" tone="positive" trend={{ value: 12, suffix: '%', label: 'vs mês ant.' }} />
          <MetricCard title="size lg (tocável)" value="US$ 74.760" size="lg" tone="positive" onClick={() => {}} />
        </div>
      </Block>

      {/* Panel + EmptyState */}
      <Block title="Panel + EmptyState">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Panel label="Painel com rótulo" action={<TrendingUp className="w-4 h-4 text-bento-muted" />}>
            <p className="text-sm text-bento-text">Conteúdo do painel. O <code className="text-note text-bento-dim">label</code> do Panel É o rótulo de seção canônico.</p>
          </Panel>
          <div className="bento-fx"><EmptyState icon={Wallet} title="Estado vazio" description="Componente EmptyState — usado sempre que uma lista/seção não tem dado." /></div>
        </div>
      </Block>

      {/* Accordion */}
      <Block title="Accordion (control-lg)">
        <div className="bento-fx overflow-hidden">
          <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-2 px-4 min-h-control-lg text-left">
            <span className="text-sm font-semibold text-bento-text">Cabeçalho do accordion</span>
            <ChevronDown className={cn('w-4 h-4 text-bento-muted transition-transform', open && 'rotate-180')} />
          </button>
          {open && <div className="px-4 pb-4 pt-1 border-t border-bento-border/60 text-sm text-bento-dim">Corpo revelado. Header usa <code className="text-note">min-h-control-lg</code> (52px).</div>}
        </div>
      </Block>

      {/* Estados */}
      <Block title="Estados (hover / focus / selecionado / disabled)">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-btn border border-bento-border px-3 min-h-control-sm inline-flex items-center text-sm text-bento-muted hover:border-lime/40">hover:border-lime/40</span>
          <span className="rounded-btn px-3 min-h-control-sm inline-flex items-center text-sm bg-lime/15 text-lime-fg">selecionado</span>
          <button className="rounded-btn border border-bento-border px-3 min-h-control-sm text-sm text-bento-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40">focus (Tab aqui)</button>
          <span className="rounded-btn border border-bento-border px-3 min-h-control-sm inline-flex items-center text-sm text-bento-text opacity-50">disabled</span>
        </div>
      </Block>

      {/* Loading / Skeleton */}
      <Block title="Loading / Skeleton">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bento-fx p-5"><p className="py-10 text-center text-sm text-bento-muted">Carregando…</p></div>
          <div className="bento-fx p-5 space-y-2">
            <div className="h-3 w-1/3 rounded-bento bg-bento-panel animate-pulse" />
            <div className="h-3 w-2/3 rounded-bento bg-bento-panel animate-pulse" />
            <div className="h-3 w-1/2 rounded-bento bg-bento-panel animate-pulse" />
          </div>
        </div>
      </Block>
    </div>
  )
}
