// "Encerrado" no Comercial (FUNIL-ENCERRADO-001) = fase dos grupos Fechamento ou Arquivo, como o usuário
// configurou em funnel_stages. Hoje: Venda Concluída, Negócio Futuro, Venda Perdida, Lixeira, Não Respondeu,
// Desqualificado e Achou Caro.
//
// FONTE ÚNICA — usada pelo rodapé do Funil (Ativos/Pipeline) e pelo Follow-up (Acompanhando × Concluídas).
// Antes o Funil usava uma lista fixa (fechado/perdido/lixeira) e contava Negócio Futuro, Não Respondeu,
// Desqualificado e Achou Caro como ativos — os totais das duas abas não batiam.
export const GRUPOS_ENCERRADOS = new Set(['Fechamento', 'Arquivo'])

// Desfechos de sistema: encerrados mesmo que alguém mova a fase para outro grupo ou renomeie o grupo.
// A fase de ganho/perda vale pelas FLAGS (is_won/is_lost), não pelo slug — slugs podem variar por equipe.
// 'lixeira' não tem flag própria; fica pelo slug, igual ao resto do sistema.
export function closedStageSlugs(stages: { slug: string; grupo: string | null; is_won?: boolean; is_lost?: boolean }[]): Set<string> {
  const closed = new Set(['lixeira'])
  for (const st of stages) {
    if (st.is_won || st.is_lost || GRUPOS_ENCERRADOS.has(st.grupo ?? '')) closed.add(st.slug)
  }
  return closed
}
