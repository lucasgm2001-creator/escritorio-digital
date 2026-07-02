import { computePreview } from './engine'
import { CLOSER_DR_GROWTH } from './catalog'
import type { CompensationEvent, CompensationPreview } from './types'

// EXEMPLO OFICIAL (COMPENSATION-004, PARTE 10) — verificação viva da engine.
// Closer DR Growth · salário US$200 · plano US$140/semana · comissão 20%.
// Esperado: comissão US$28/semana, máximo 4 semanas → total US$112. Salário US$200.
export const EXAMPLE_SALE_EVENT: CompensationEvent = {
  type: 'sale.created',
  collaboratorId: 'collab-closer',
  occurredAt: '2026-07-01T12:00:00Z',
  weeklyValue: 140,
  saleValue: 140,
}

export function runCloserExample(): CompensationPreview {
  return computePreview({ ...CLOSER_DR_GROWTH, teamId: 'example' }, EXAMPLE_SALE_EVENT)
}

// Verificação declarada (não executada por runner; a tela de Remuneração exibe o resultado real):
//   const p = runCloserExample()
//   p.salary === 200
//   p.commission === 112
//   p.lines.find(l => l.type === 'commission_percent') → { perInstallment: 28, installments: 4, total: 112 }
