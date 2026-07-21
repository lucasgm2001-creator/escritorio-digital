import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from './ClientWorkspaceService'
import { getClientPaymentsByClient } from '@/server/repositories/ClientRepository'
import { dueDateFor } from '@/lib/commission/actions'
import { todaySP, dowOfYmd } from '@/lib/date'
import { receivedRevenue } from '@/core/metrics/revenue'

// Financeiro do Cliente (CLIENT-003). LÊ a receita real (client_payments) e DERIVA as métricas —
// sem alterar nenhuma regra financeira: reusa o helper canônico dueDateFor (mesmo do agendador/cron).
// Isolamento por equipe (TEAM-001) via getClientWorkspace. Só leitura, nada de escrita/comissão.

export type ClientFinancePayment = { numeroSemana: number; valorUsd: number; paidOn: string | null; dueOn: string | null; status: string; anulado: boolean }

export type ClientFinanceVM = {
  planWeekly: number
  status: string
  periodicidade: 'semanal' | 'mensal'  // como o cliente paga → apresentação (semana × mês) na UI (Parte 4)
  totalRecebido: number
  semanasPagas: number
  semanasPendentes: number
  proximaSemana: number | null
  proximaCobranca: string | null   // YMD do vencimento da próxima semana a receber
  payments: ClientFinancePayment[]  // ordenadas por número de semana (asc)
}

// "Hoje" (Brasília) e dia-da-semana civil vêm da fonte única @/lib/date; a REGRA de vencimento é o dueDateFor.

export async function getClientFinance(context: RequestContext, clientId: string): Promise<ClientFinanceVM | null> {
  const client = await getClientWorkspace(clientId) // team-scoped (TEAM-001) + cache por request
  if (!client) return null

  const raw = await getClientPaymentsByClient(clientId)
  const payments: ClientFinancePayment[] = raw
    .map(p => ({
      numeroSemana: Number(p.numero_semana),
      valorUsd: Number((p.status === 'paga' || p.status === 'parcial') ? (p.valor_pago_usd ?? p.valor_usd ?? 0) : (p.valor_previsto_usd ?? p.valor_usd ?? 0)),
      paidOn: p.paid_on ?? null, dueOn: p.due_on ?? p.paid_on ?? null,
      status: p.status ?? (p.anulado ? 'anulada' : 'paga'), anulado: !!p.anulado,
    }))
    .sort((a, b) => a.numeroSemana - b.numeroSemana)

  const active = payments.filter(p => p.status === 'paga')
  const totalRecebido = receivedRevenue(payments.map(p => ({ valor_usd: p.valorUsd, paid_on: p.paidOn, anulado: p.anulado })))
  const semanasPagas = active.length
  const paidNums = new Set(active.map(p => p.numeroSemana))
  const registeredNums = new Set(payments.map(p => p.numeroSemana))

  let semanasPendentes = 0
  let proximaSemana: number | null = null
  let proximaCobranca: string | null = null

  const anchor = client.billing_anchor_date ?? client.start_date
  const start = anchor ? String(anchor).slice(0, 10) : null
  if (start && client.status === 'ativo') {
    const dia = client.dia_pagamento_semana ?? dowOfYmd(start)
    const today = todaySP()
    // Semanas VENCIDAS até hoje = maior n cujo vencimento (dueDateFor) já passou (datas monotônicas).
    let dueCount = 0
    for (let n = 1; n <= 520; n++) { if (dueDateFor(start, dia, n) <= today) dueCount = n; else break }
    // Pendentes = semanas vencidas SEM registro ativo.
    for (let n = 1; n <= dueCount; n++) if (!paidNums.has(n)) semanasPendentes++
    // Próxima semana a receber = menor n ainda não pago ativamente + seu vencimento.
    let n = 1
    while (registeredNums.has(n)) n++
    proximaSemana = n
    proximaCobranca = dueDateFor(start, dia, n)
  }

  return {
    planWeekly: Number(client.plan_weekly ?? 0),
    status: client.status,
    periodicidade: (client.periodicidade === 'mensal' ? 'mensal' : 'semanal'),
    totalRecebido,
    semanasPagas,
    semanasPendentes,
    proximaSemana,
    proximaCobranca,
    payments,
  }
}
