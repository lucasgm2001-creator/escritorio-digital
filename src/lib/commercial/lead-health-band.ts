import type { LeadHubVM } from './lead-hub-types'

// Saúde do Lead (LEAD/CRM). Camada de APRESENTAÇÃO: classifica métricas que o LeadHubService JÁ calculou
// (temperatura, dias parado) numa FAIXA visual — não recalcula negócio, só mapeia para rótulo/cor
// (ARCH-001: a UI não inventa métrica; aqui é só a leitura visual do que o serviço produziu).
export type LeadHealthBandKey = 'excelente' | 'boa' | 'atencao' | 'critica'
export type LeadHealthBand = { key: LeadHealthBandKey; label: string; cls: string; dot: string; hint: string }

const BANDS: Record<LeadHealthBandKey, Omit<LeadHealthBand, 'key'>> = {
  excelente: { label: 'Excelente', cls: 'text-emerald-300 bg-emerald-900/20 border-emerald-700/40', dot: 'bg-emerald-400', hint: 'Quente e ativo' },
  boa:       { label: 'Boa',       cls: 'text-lime-fg bg-lime/10 border-lime/25',                    dot: 'bg-lime',        hint: 'Em andamento' },
  atencao:   { label: 'Atenção',   cls: 'text-amber-300 bg-amber-900/20 border-amber-700/40',        dot: 'bg-amber-400',   hint: 'Esfriando ou parado' },
  critica:   { label: 'Crítica',   cls: 'text-red-300 bg-red-900/20 border-red-700/40',              dot: 'bg-red-400',     hint: 'Parado há muito tempo' },
}

export function leadHealthBand(vm: LeadHubVM): LeadHealthBand {
  const stuck = vm.health.daysStuck
  const temp = vm.executive.temperature

  let key: LeadHealthBandKey
  if (temp === 'quente' && stuck <= 7) key = 'excelente'
  else if (stuck >= 21) key = 'critica'
  else if (stuck >= 8 || temp === 'frio') key = 'atencao'
  else key = 'boa'

  return { key, ...BANDS[key] }
}
