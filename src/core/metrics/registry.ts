// KPI REGISTRY — registro OFICIAL das métricas do sistema (EXECUTIVE-METRICS-001, Parte 3). Documentação VIVA:
// cada número que aparece em qualquer tela (Hall, Dashboard, Financeiro, Relatórios, PDF, Minha Remuneração,
// Administração, IA) tem UMA definição, UMA fonte de dados e UMA função que o calcula. Nenhuma tela inventa KPI.
// Se uma definição mudar, muda AQUI e na função canônica — nunca numa tela.

export type KpiKey =
  | 'receita_recebida' | 'valor_fechado' | 'receita_prevista'
  | 'mrr' | 'arr' | 'ticket_medio' | 'conversao'
  | 'clientes_ativos' | 'clientes_novos'
  | 'receita_por_vendedor' | 'receita_por_plano'

export interface KpiDefinition {
  key: KpiKey
  nome: string
  descricao: string
  fonteTabela: string        // tabela(s) canônica(s) de onde o dado nasce
  fonteFuncao: string        // função/módulo ÚNICO que calcula (fonte única de código)
  formula: string
  unidade: 'USD' | '%' | 'contagem'
  consumidores: string[]     // quem exibe (todos consomem ExecutiveMetricsService)
  ultimaAlteracao: string    // YYYY-MM-DD
}

const CONSUMERS_ALL = ['Hall', 'Dashboard Executivo', 'Financeiro', 'Relatórios', 'PDF', 'Administração', 'IA']

export const KPI_REGISTRY: KpiDefinition[] = [
  {
    key: 'receita_recebida', nome: 'Receita Recebida',
    descricao: 'Dinheiro REALMENTE recebido no período. Nunca usa deals.',
    fonteTabela: 'client_payments (paid_on, valor_usd, anulado)',
    fonteFuncao: 'core/metrics/revenue.receivedRevenueBetween',
    formula: 'Σ client_payments.valor_usd (não anulados) com paid_on ∈ [início, fim]',
    unidade: 'USD', consumidores: CONSUMERS_ALL, ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'valor_fechado', nome: 'Valor Fechado',
    descricao: 'Soma dos CONTRATOS fechados no período. Não é dinheiro recebido.',
    fonteTabela: 'deals (valor_total_usd, data_fechamento)',
    fonteFuncao: 'core/metrics/sales.closedValue',
    formula: 'Σ deals.valor_total_usd com data_fechamento ∈ [início, fim]',
    unidade: 'USD', consumidores: ['Dashboard Executivo', 'Relatórios', 'PDF', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'receita_prevista', nome: 'Receita Prevista',
    descricao: 'Cobranças FUTURAS ainda não recebidas, derivadas do cronograma financeiro dos clientes ativos.',
    fonteTabela: 'clients (start_date, dia_pagamento_semana, plan_weekly, status) + dueDateFor',
    fonteFuncao: 'ExecutiveMetricsService.forecast (reusa lib/commission/actions.dueDateFor)',
    formula: 'Σ clientes ativos de (nº de vencimentos em (hoje, fim do período] × valor semanal)',
    unidade: 'USD', consumidores: ['Financeiro', 'Dashboard Executivo', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'mrr', nome: 'MRR',
    descricao: 'Receita recorrente mensal da carteira ATIVA. Não depende do que entrou no mês.',
    fonteTabela: 'clients (status=ativo, plan_weekly)',
    fonteFuncao: 'core/metrics/portfolio.mrr',
    formula: 'Σ clientes ativos (plan_weekly × 4)  [valor_mensal = 4× semanal, migration 049]',
    unidade: 'USD', consumidores: ['Financeiro', 'Dashboard Executivo', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'arr', nome: 'ARR',
    descricao: 'Receita recorrente anual = MRR × 12.',
    fonteTabela: 'derivada de MRR',
    fonteFuncao: 'core/metrics/portfolio.arr',
    formula: 'MRR × 12',
    unidade: 'USD', consumidores: ['Financeiro', 'Dashboard Executivo', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'ticket_medio', nome: 'Ticket Médio',
    descricao: 'Indicador COMERCIAL: valor dos contratos fechados ÷ clientes conquistados no período.',
    fonteTabela: 'deals (valor_total_usd, data_fechamento)',
    fonteFuncao: 'core/metrics/sales.averageTicket',
    formula: 'valor_fechado ÷ nº de contratos fechados no período',
    unidade: 'USD', consumidores: ['Dashboard Executivo', 'Relatórios', 'PDF', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'conversao', nome: 'Conversão',
    descricao: 'Taxa de fechamento SEMPRE respeitando o filtro de período. Sem versão all-time escondida.',
    fonteTabela: 'leads (status, origem)',
    fonteFuncao: 'lib/funnelMetrics.funnelConversionPct',
    formula: 'fechados ÷ base (leads do período, exceto origem=cliente_existente e lixeira)',
    unidade: '%', consumidores: CONSUMERS_ALL, ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'clientes_ativos', nome: 'Clientes Ativos',
    descricao: 'Clientes com status ativo (carteira atual).',
    fonteTabela: 'clients (status=ativo)',
    fonteFuncao: 'core/metrics/portfolio.activeClientsCount',
    formula: 'count(clients where status = ativo)',
    unidade: 'contagem', consumidores: CONSUMERS_ALL, ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'clientes_novos', nome: 'Clientes Novos',
    descricao: 'Clientes que entraram no período (start_date, fallback created_at).',
    fonteTabela: 'clients (start_date/created_at)',
    fonteFuncao: 'core/metrics/portfolio.newClientsCount',
    formula: 'count(clients com start_date ∈ [início, fim])',
    unidade: 'contagem', consumidores: ['Financeiro', 'Dashboard Executivo', 'Relatórios', 'IA'], ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'receita_por_vendedor', nome: 'Receita por Vendedor',
    descricao: 'Receita recebida no período agrupada pelo responsável do cliente. Mesmo cálculo em toda tela.',
    fonteTabela: 'client_payments + clients.assigned_name',
    fonteFuncao: 'core/metrics/revenue.receivedRevenueBySeller',
    formula: 'Σ client_payments (período) por clients.assigned_name',
    unidade: 'USD', consumidores: CONSUMERS_ALL, ultimaAlteracao: '2026-07-05',
  },
  {
    key: 'receita_por_plano', nome: 'Receita por Plano',
    descricao: 'Receita recebida no período agrupada pelo plano do cliente.',
    fonteTabela: 'client_payments + clients.plano_id + plans.nome',
    fonteFuncao: 'core/metrics/revenue.receivedRevenueByPlan',
    formula: 'Σ client_payments (período) por plano do cliente',
    unidade: 'USD', consumidores: ['Financeiro', 'Dashboard Executivo', 'Relatórios', 'IA'], ultimaAlteracao: '2026-07-05',
  },
]

export function kpiByKey(key: KpiKey): KpiDefinition | undefined {
  return KPI_REGISTRY.find(k => k.key === key)
}
