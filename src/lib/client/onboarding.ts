// Modelo do roteiro de ONBOARDING (ONBOARDING-003).
//
// O roteiro deixou de viver no código: agora é `onboarding_steps` no banco, editável em Configurações.
// Aqui ficam só o CONTRATO (tipos) e as funções PURAS de progresso/ordenação — nada de dado fixo, para
// não existir uma segunda versão do roteiro competindo com a do banco.

export type OnboardingStatus = 'concluido' | 'pendente'

export type OnboardingStep = {
  id: string
  parentId: string | null
  titulo: string
  ajuda: string | null
  pedeResposta: boolean
  rotuloResposta: string | null
  exemploResposta: string | null
  posicao: number
}

/** Tópico com seus subtópicos, já na ordem de exibição. */
export type OnboardingTopic = OnboardingStep & { filhos: OnboardingStep[] }

/** Monta a hierarquia de um nível a partir da lista plana do banco. */
export function buildTopics(steps: OnboardingStep[]): OnboardingTopic[] {
  const porPosicao = (a: OnboardingStep, b: OnboardingStep) => a.posicao - b.posicao || a.titulo.localeCompare(b.titulo)
  const raizes = steps.filter(s => !s.parentId).sort(porPosicao)
  return raizes.map(r => ({ ...r, filhos: steps.filter(s => s.parentId === r.id).sort(porPosicao) }))
}

/**
 * Ordem LINEAR da reunião: tópico, depois seus subtópicos, depois o próximo tópico. É nessa ordem que o
 * formulário abre uma etapa por vez — seguir a numeração falada ("3, 3.1, 4") é o que o roteiro promete.
 */
export function flattenTopics(topicos: OnboardingTopic[]): OnboardingStep[] {
  return topicos.flatMap(t => [t as OnboardingStep, ...t.filhos])
}

/** Numeração visível: 1, 2, 3, 3.1, 4… — derivada da posição, nunca gravada. */
export function numeracao(topicos: OnboardingTopic[]): Map<string, string> {
  const out = new Map<string, string>()
  topicos.forEach((t, i) => {
    out.set(t.id, String(i + 1))
    t.filhos.forEach((f, j) => out.set(f.id, `${i + 1}.${j + 1}`))
  })
  return out
}

/** Primeira etapa ainda SEM desfecho, na ordem da reunião. null = roteiro terminado. */
export function proximaEtapaAberta(ordem: OnboardingStep[], decididas: Set<string>): string | null {
  return ordem.find(s => !decididas.has(s.id))?.id ?? null
}

/** Progresso: só 'concluido' conta. 'pendente' é etapa tratada que NÃO resolveu — não é avanço. */
export function onboardingProgress(ordem: OnboardingStep[], porEtapa: Map<string, OnboardingStatus>): {
  concluidas: number; pendentes: number; abertas: number; total: number; pct: number
} {
  const total = ordem.length
  let concluidas = 0, pendentes = 0
  for (const s of ordem) {
    const st = porEtapa.get(s.id)
    if (st === 'concluido') concluidas++
    else if (st === 'pendente') pendentes++
  }
  return { concluidas, pendentes, abertas: total - concluidas - pendentes, total,
    pct: total > 0 ? Math.round((concluidas / total) * 100) : 0 }
}

/** Linha crua do banco → modelo. Uma só conversão, usada por todos os consumidores. */
export function mapStep(row: {
  id: string; parent_id: string | null; titulo: string; ajuda: string | null
  pede_resposta: boolean; rotulo_resposta: string | null; exemplo_resposta: string | null; posicao: number
}): OnboardingStep {
  return {
    id: row.id, parentId: row.parent_id, titulo: row.titulo, ajuda: row.ajuda,
    pedeResposta: row.pede_resposta, rotuloResposta: row.rotulo_resposta,
    exemploResposta: row.exemplo_resposta, posicao: row.posicao,
  }
}

export const STEP_COLUMNS = 'id, parent_id, titulo, ajuda, pede_resposta, rotulo_resposta, exemplo_resposta, posicao'
