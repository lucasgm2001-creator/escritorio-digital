import Link from 'next/link'
import { Plug, Activity, DollarSign, Target, TrendingUp } from 'lucide-react'
import { TrafficHeader } from './TrafficHeader'
import { TrafficPlatformGrid } from './TrafficPlatformGrid'

// Dashboard de Tráfego (UX-TRAFFIC-ENTERPRISE-001). SEM integração conectada, a tela nunca mostra dezenas de
// KPIs vazios: mostra o ESTADO da integração + o que o painel entrega (narrativa) + UMA ação (conectar) + uma
// PRÉVIA ilustrativa da hierarquia (Saúde → Gastos → Conversões → Resultados). Só UX/apresentação — nenhuma
// API/serviço/dado/regra. O MESMO componente serve o módulo global e a aba Tráfego do cliente (clientName).

// O que o painel responde assim que conectar (narrativa — Parte 5).
const BENEFITS = [
  { Icon: Activity,   q: 'Está saudável?',        a: 'Um índice de saúde no topo — entrega, orçamento e queda de ROAS num lugar só.' },
  { Icon: DollarSign, q: 'Quanto estou gastando?', a: 'Investimento consolidado (Meta, Google e mais), por plataforma e por cliente.' },
  { Icon: Target,     q: 'Quanto estou gerando?',  a: 'Conversões, receita e ROAS atribuídos a cada campanha.' },
  { Icon: TrendingUp, q: 'Preciso agir?',         a: 'A campanha que precisa de atenção aparece primeiro — não enterrada em quinze números.' },
]

// Hierarquia do painel conectado (Parte 3) — aqui como PRÉVIA (exemplo), nunca número falso solto.
const PREVIEW = [
  { label: 'Gastos', hint: 'Investimento' },
  { label: 'Conversões', hint: 'Leads e vendas' },
  { label: 'Resultados', hint: 'ROAS · CPA · receita' },
]

export function TrafficDashboard({ clientName }: { clientName?: string }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <TrafficHeader
        breadcrumb={clientName ? ['Tráfego', clientName] : ['Tráfego']}
        title="Tráfego"
        subtitle={clientName ? `Mídia paga de ${clientName} — Meta, Google e mais.` : 'Mídia paga consolidada — Meta, Google e mais.'}
      />

      {/* Herói: estado da integração + narrativa + UMA ação principal (Partes 2/5/6) */}
      <div className="bento-fx p-6 sm:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <span className="w-14 h-14 rounded-frame bg-lime/10 border border-lime/25 flex items-center justify-center">
            <Plug className="w-7 h-7 text-lime-fg" />
          </span>
          <div className="space-y-1.5 max-w-xl">
            <p className="font-tech text-label uppercase tracking-label text-lime-fg">Nenhuma conta conectada</p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-bento-text">Conecte para ativar o painel de tráfego</h2>
            <p className="text-sm text-bento-muted leading-relaxed">
              Assim que você conectar Meta ou Google, este painel passa a responder em tempo real: quanto você
              gasta, quanto gera, se está saudável e qual campanha precisa de atenção.
            </p>
          </div>
          <Link href="/trafego/contas" className="bento-btn inline-flex items-center gap-1.5 px-5 min-h-control rounded-btn text-sm font-semibold">
            <Plug className="w-4 h-4" />Conectar minha primeira conta
          </Link>
        </div>

        {/* Benefícios — o que você vai ver (2×2 no desktop, empilha no mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6">
          {BENEFITS.map(({ Icon, q, a }) => (
            <div key={q} className="flex items-start gap-3 rounded-bento border border-bento-border bg-bento-bg p-3">
              <span className="w-8 h-8 rounded-btn bg-bento-panel border border-bento-border flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-lime-fg" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-bento-text">{q}</p>
                <p className="text-note text-bento-muted leading-relaxed">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prévia ilustrativa da hierarquia (Partes 3/6) — claramente EXEMPLO, sem dado falso (não interativa) */}
      <section>
        <p className="font-tech text-label uppercase tracking-label text-bento-muted mb-2">Prévia do painel · exemplo</p>
        <div aria-hidden className="space-y-2.5 opacity-60 select-none pointer-events-none">
          {/* Saúde — topo da hierarquia */}
          <div className="bento-fx p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-bento bg-lime/10 border border-lime/25 flex items-center justify-center shrink-0"><Activity className="w-4 h-4 text-lime-fg" /></span>
              <div className="min-w-0">
                <p className="font-tech text-label uppercase tracking-label text-bento-muted">Saúde das campanhas</p>
                <p className="font-display text-2xl font-bold text-bento-text leading-none tabular-nums">•••</p>
              </div>
            </div>
            <span className="text-note text-bento-dim hidden sm:block">entrega · orçamento · ritmo</span>
          </div>
          {/* Gastos · Conversões · Resultados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PREVIEW.map(p => (
              <div key={p.label} className="bento-fx p-4 space-y-1">
                <p className="font-tech text-label uppercase tracking-label text-bento-muted">{p.label}</p>
                <p className="font-display text-xl font-bold text-bento-text leading-none tabular-nums">•••</p>
                <p className="text-note text-bento-dim">{p.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plataformas disponíveis — estado da integração (Parte 6) */}
      <section>
        <p className="font-tech text-label uppercase tracking-label text-bento-muted mb-2">Plataformas disponíveis</p>
        <TrafficPlatformGrid />
      </section>
    </div>
  )
}
