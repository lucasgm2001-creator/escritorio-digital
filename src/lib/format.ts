// Fonte única de formatação de MOEDA. Consolida cópias que viviam espalhadas em ~9 componentes.
// (Os helpers de DATA — ymd/ddmm — migraram para a fonte única de datas em `@/lib/date`.)

// US$ compacto com abreviação M/k (cards do funil, métricas). Zero → "US$ 0".
export function usdCompact(val: number): string {
  if (val >= 1_000_000) return `US$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `US$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `US$ ${val.toLocaleString('pt-BR')}`
  return 'US$ 0'
}

// US$ / R$ com 2 casas (comissões, equipe).
export const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
