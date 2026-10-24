// "Encerrado" no Comercial (FUNIL-ENCERRADO-001) = fase dos grupos Fechamento ou Arquivo, como o usuário
// configurou em funnel_stages. Hoje: Venda Concluída, Negócio Futuro, Venda Perdida, Lixeira, Não Respondeu,
// Desqualificado e Achou Caro.
//
// FONTE ÚNICA — usada pelo rodapé do Funil (Ativos/Pipeline) e pelo Follow-up (Acompanhando × Concluídas).
// Antes o Funil usava uma lista fixa (fechado/perdido/lixeira) e contava Negócio Futuro, Não Respondeu,
// Desqualificado e Achou Caro como ativos — os totais das duas abas não batiam.
export const GRUPOS_ENCERRADOS = new Set(['Fechamento', 'Arquivo'])

// Desfechos de sistema: encerrados mesmo que alguém mova a fase para outro grupo.
const SEMPRE_ENCERRADOS = ['fechado', 'perdido', 'lixeira']

export function closedStageSlugs(stages: { slug: string; grupo: string | null }[]): Set<string> {
  const closed = new Set(SEMPRE_ENCERRADOS)
  for (const st of stages) if (GRUPOS_ENCERRADOS.has(st.grupo ?? '')) closed.add(st.slug)
  return closed
}
