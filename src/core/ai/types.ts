// Fundação da camada de IA (Constituição, Título 9). NÃO altera a IA atual (rotas /api/agent, briefings,
// etc.). Apenas ORGANIZA os contratos para a IA se tornar uma camada transversal sobre eventos + read-models,
// assistiva e auditável — nunca decidindo sozinha sobre dinheiro/permissão.

export type AIContext = {
  teamId: string
  userId: string | null
  // Futuro: read-models e eventos relevantes entram aqui como entrada da IA.
}

export type AITaskKind = 'insight' | 'summary' | 'next_action' | 'forecast' | 'report'

export type AITask = {
  kind: AITaskKind
  context: AIContext
  input: Record<string, unknown>
}

export type AIResponse<TData = unknown> = {
  ok: boolean
  data: TData | null
  error: string | null
}

export type AIInsight = { title: string; detail: string; severity: 'info' | 'attention' }
export type AINextAction = { title: string; reason: string }
export type AINotification = { title: string; body: string }

// Provider: abstrai o modelo (Anthropic hoje). Engine: orquestra tarefas assistivas sobre o contexto.
export interface AIProvider {
  run(task: AITask): Promise<AIResponse>
}

export interface AIEngine {
  insight(context: AIContext): Promise<AIResponse<AIInsight[]>>
  nextAction(context: AIContext): Promise<AIResponse<AINextAction[]>>
}
