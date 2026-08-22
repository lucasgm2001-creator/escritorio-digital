// Ordem dos leads DENTRO de cada fase do funil (FUNIL-ORDEM-001).
//
// Regra: quem entrou na fase por ÚLTIMO fica no TOPO; os mais antigos descem. Como moveLead grava
// `stage_changed_at = agora` a cada mudança de fase, mover um lead para uma coluna automaticamente o
// coloca no topo dela — que é exatamente o comportamento pedido, sem campo novo e sem escrita extra.
//
// Antes a coluna herdava a ordem da query (score desc), então a posição não dizia nada sobre quando o
// lead chegou ali: um lead de score alto parado há dois meses ficava acima de um que entrou hoje.
//
// Não existe ordenação manual para preservar: `leads` não tem coluna de posição e o drag-and-drop só
// muda o status (a coluna), nunca a posição dentro dela.
//
// FONTE ÚNICA — usada pelo Kanban (desktop) e pelo PhaseSelectorMobile (celular), que renderizam as
// mesmas colunas por caminhos diferentes e precisam concordar.

export type FunnelOrderable = {
  stage_changed_at?: string | null
  received_at?: string | null
  created_at?: string | null
}

/** Momento em que o lead entrou na fase atual. Cai para chegada e depois criação se faltar. */
export function stageEntryAt(lead: FunnelOrderable): string {
  return lead.stage_changed_at ?? lead.received_at ?? lead.created_at ?? ''
}

/** Comparador: mais recente na fase primeiro (topo). Vazio vai para o fim (base da coluna). */
export function byStageEntryDesc(a: FunnelOrderable, b: FunnelOrderable): number {
  const x = stageEntryAt(a), y = stageEntryAt(b)
  if (!x && !y) return 0
  if (!x) return 1
  if (!y) return -1
  return y.localeCompare(x)   // ISO 8601 compara direto como string
}

/** Cópia ordenada dos leads de uma fase. Não muta o array recebido. */
export function sortByStageEntry<T extends FunnelOrderable>(leads: T[]): T[] {
  return [...leads].sort(byStageEntryDesc)
}
