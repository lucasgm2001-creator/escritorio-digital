// Limite de equipes por usuário — FONTE ÚNICA (TEAM-ADMIN-002, Part 6). Antes o "4" estava hardcoded no
// server action e na UI; agora vive aqui. NÃO é regra de banco: o RPC redeem_invite continua idempotente e
// aditivo (ON CONFLICT DO NOTHING) — o limite é uma regra de APLICAÇÃO, validada no servidor.
//
// Arquitetura pronta para crescer: quando o limite passar a variar por plano/tier, implemente em
// maxTeamsForUser(context) (a assinatura já recebe um contexto) — os call sites não mudam. Sem número mágico
// espalhado: qualquer tela/rota lê daqui.

export const MAX_TEAMS_PER_USER = 4

// Contrato de crescimento. Hoje o limite é fixo; amanhã pode depender do plano da conta. Manter o contexto
// opcional permite evoluir sem tocar em quem chama.
export type TeamLimitContext = {
  plan?: string | null
}

// Seam por plano: hoje vazio (todos os planos usam MAX_TEAMS_PER_USER). Para crescer, adicione entradas
// aqui (ex.: { pro: 10, enterprise: 50 }) — nenhum call site muda.
const LIMIT_BY_PLAN: Record<string, number> = {}

export function maxTeamsForUser(context?: TeamLimitContext): number {
  const plan = context?.plan
  if (plan && plan in LIMIT_BY_PLAN) return LIMIT_BY_PLAN[plan]
  return MAX_TEAMS_PER_USER
}

// Já atingiu o limite? Centraliza a comparação para UI e servidor não repetirem `>= 4`.
export function hasReachedTeamLimit(teamCount: number, context?: TeamLimitContext): boolean {
  return teamCount >= maxTeamsForUser(context)
}
