type ScoreFaixa =
  | 'Perdido'
  | 'Muito Frio'
  | 'Frio'
  | 'Morno'
  | 'Quente'
  | 'Muito Quente'
  | 'Fechando'

interface ScoreInfo {
  faixa: ScoreFaixa
  color: string
  bg: string
  border: string
  dot: string
}

// Cores SEMÂNTICAS de score em tons translúcidos dark; o tema claro é resolvido
// pela camada de compatibilidade em globals.css (não usar bg-*-50 hardcoded,
// que ficava claro no dark e quebrava os badges).
export function getScoreInfo(score: number): ScoreInfo {
  if (score <= 200) return { faixa: 'Perdido',      color: 'text-slate-400',  bg: 'bg-slate-800/40',  border: 'border-slate-700/50',  dot: 'bg-slate-500' }
  if (score <= 400) return { faixa: 'Muito Frio',   color: 'text-blue-400',   bg: 'bg-blue-900/30',   border: 'border-blue-800/50',   dot: 'bg-blue-500' }
  if (score <= 550) return { faixa: 'Frio',         color: 'text-cyan-400',   bg: 'bg-cyan-900/30',   border: 'border-cyan-800/50',   dot: 'bg-cyan-500' }
  if (score <= 650) return { faixa: 'Morno',        color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-800/50', dot: 'bg-yellow-500' }
  if (score <= 800) return { faixa: 'Quente',       color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-800/50', dot: 'bg-orange-500' }
  if (score <= 950) return { faixa: 'Muito Quente', color: 'text-red-400',    bg: 'bg-red-900/30',    border: 'border-red-800/50',    dot: 'bg-red-500' }
  return                   { faixa: 'Fechando',     color: 'text-green-400',  bg: 'bg-green-900/30',  border: 'border-green-800/50',  dot: 'bg-green-500' }
}
