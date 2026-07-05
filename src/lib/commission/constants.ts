// Corte da COMISSÃO DE REUNIÃO (PRODUCT-SPRINT-003, Parte 6). A partir da competência JULHO/2026, reunião NÃO
// gera mais comissão. Reuniões até 30/06/2026 permanecem exatamente como estão. FONTE ÚNICA da regra — usada na
// CRIAÇÃO (moveLead / reconstrução histórica) e em TODAS as somas de dinheiro (Minha Remuneração, PDF, Dashboard,
// Relatórios). Não cria linha US$0 nem placeholder: a reunião ≥ corte simplesmente não vira comissão. O motor
// financeiro (payWeek/calc) é o mesmo — isto é só um gate de elegibilidade por data.
export const MEETINGS_COMMISSION_CUTOFF = '2026-07-01' // YYYY-MM-DD (competência = met_on)

// A reunião com esta competência (met_on) ainda gera comissão? Só se for ANTES do corte.
export function meetingCommissionCounts(metOn: string | null | undefined): boolean {
  return !!metOn && String(metOn).slice(0, 10) < MEETINGS_COMMISSION_CUTOFF
}
