// Saúde do Cliente (CLIENT-004, Parte 4). Camada de APRESENTAÇÃO: classifica dados REAIS já apurados
// (status, semanas pendentes, tempo sem atividade) numa faixa visual. Regra simples e ISOLADA aqui para
// evoluir depois — não recalcula negócio, só mapeia para rótulo/cor.
export type ClientHealthKey = 'excelente' | 'boa' | 'atencao' | 'critica'
export type ClientHealthBand = { key: ClientHealthKey; label: string; cls: string; dot: string; hint: string }

const BANDS: Record<ClientHealthKey, Omit<ClientHealthBand, 'key'>> = {
  excelente: { label: 'Excelente', cls: 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40', dot: 'bg-emerald-400', hint: 'Em dia e ativo' },
  boa:       { label: 'Boa',       cls: 'text-lime-fg bg-lime/10 border-lime/25',                    dot: 'bg-lime',        hint: 'Em andamento' },
  atencao:   { label: 'Atenção',   cls: 'text-amber-300 bg-amber-900/20 border-amber-700/40',        dot: 'bg-amber-400',   hint: 'Pendência ou sem atividade' },
  critica:   { label: 'Crítica',   cls: 'text-red-300 bg-red-900/20 border-red-700/40',              dot: 'bg-red-400',     hint: 'Inativo ou em atraso' },
}

export function clientHealthBand(input: { status: string; semanasPendentes: number; daysSinceActivity: number | null }): ClientHealthBand {
  let key: ClientHealthKey
  if (input.status !== 'ativo') key = 'critica'
  else if (input.semanasPendentes >= 2) key = 'critica'
  else if (input.semanasPendentes === 1) key = 'atencao'
  else if (input.daysSinceActivity != null && input.daysSinceActivity > 30) key = 'atencao'
  else if (input.daysSinceActivity != null && input.daysSinceActivity <= 7) key = 'excelente'
  else key = 'boa'
  return { key, ...BANDS[key] }
}
