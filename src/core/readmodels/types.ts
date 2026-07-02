// Fundação de READ MODELS (Constituição, Título 4/5). Separa os DADOS TRANSACIONAIS (fonte da verdade)
// da LEITURA CONSOLIDADA que alimenta Dashboard, Relatórios, IA e Forecast. Nada é populado agora —
// só a arquitetura. Hoje as projeções serão calculadas sob demanda; no futuro, materializadas por eventos.

export type ReadModelKey =
  | 'commercial.funnel'
  | 'commercial.conversion'
  | 'financial.revenue'
  | 'people.headcount'
  | 'activity.feed'

export type ReadModelScope = { teamId: string }

// Uma projeção de leitura. build() consolida os dados transacionais numa forma pronta para consumo.
export interface ReadModel<TData> {
  readonly key: ReadModelKey
  build(scope: ReadModelScope): Promise<TData>
}
