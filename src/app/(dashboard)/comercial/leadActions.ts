import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'
import type { createClient } from '@/lib/supabase/client'
import { ALL_COLUMNS, type LeadStatus } from './types'
import { ymd, todaySP as spToday } from '@/lib/date'
import { markMilestones } from '@/lib/leadMilestones'
import { wonSlug, marcosForSlug, type FunnelStage } from '@/lib/funnelStages'
import { payClientWeek, registerMeeting, resolveSellerForCommission } from '@/lib/commission/actions'
import { weeklyCommissionUsd, hasCommissionPct, LEGACY_VPS_USD, DEFAULT_TETO_SEMANAS } from '@/lib/commission/planCommission'
import { meetingCommissionCounts } from '@/lib/commission/constants'
import { logStageEvent } from '@/lib/stageEvents'
import { stageTaskFor } from '@/lib/tasks/task-kind'
import { DEFAULT_TASK_OWNER_ID, DEFAULT_TASK_OWNER_NAME } from '@/lib/tasks/default-task-owner'

type SupaClient = ReturnType<typeof createClient>

// Mensagem de efeito colateral (ex: comissão lançada). O funil mostra como toast;
// o agente do Hall mostra como texto no chat.
export type ActionNote = { message: string; type: 'success' | 'error' }

// Campos mínimos que mover/won-flow precisam. Um Lead completo é compatível.
export interface MovableLead {
  id: string
  name: string
  status: LeadStatus
  email?: string | null
  phone?: string | null
  company?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
  city?: string | null        // geografia herdada pelo cliente ao fechar (LEAD-GEO-001) — mesmas colunas
  state?: string | null
  area_code?: string | null
}

// Fluxo de "ganhou" (lead → Venda Fechada): atividade + cliente (idempotente, reativa
// se inativo) + LANÇA o deal de comissão (+1ª semana paga). Idempotente: não duplica se
// o lead sair e voltar (dedup por lead_id, com fallback client_name+seller).
// Extraído do KanbanBoard pra ser reusado pelo agente do Hall — MESMA lógica, sem duplicar.
// FIX-P0-TEAMID-WRITES: teamId (equipe ativa) carimba as escritas team-scoped — o trigger só cobre usuário
// de 1 equipe. Opcional/último parâmetro: sem ele (ex.: chamadas antigas/servidor) volta ao trigger.
// customWeeklyUsd = PLANO AVULSO (PLANO-AVULSO-001): valor semanal só desta venda. Não vira linha em `plans`
// — o cliente nasce com plano_id null e plan_weekly = este valor, que é exatamente como resolveClientPlan já
// lê (plano_id null → plan_weekly). Cobrança, agendador e receita seguem idênticos aos planos do catálogo, e a
// comissão usa o MESMO % do catálogo sobre este valor, nas mesmas 4 primeiras semanas.
async function runWonFlow(supabase: SupaClient, lead: MovableLead, userName: string, planoId: string | null = null, teamId: string | null = null, customWeeklyUsd: number | null = null): Promise<ActionNote[]> {
  const notes: ActionNote[] = []
  const today = ymd(new Date())

  await supabase.from('activities').insert({
    type: 'lead',
    description: `Lead ${lead.name} movido para Venda Fechada`,
    user_name: userName,
    entity_id: lead.id,
    ...(teamId ? { team_id: teamId } : {}),
  })

  // 1) Cliente idempotente: reusa se já existe (por nome); senão cria. Reativa se inativo.
  let clientId: string | null = null
  let existingQuery = supabase.from('clients').select('id, status').eq('name', lead.name)
  if (teamId) existingQuery = existingQuery.eq('team_id', teamId)
  const { data: existing } = await existingQuery.limit(1)
  if (existing && existing.length) {
    clientId = existing[0].id
    if (existing[0].status !== 'ativo') {
      await supabase.from('clients').update({ status: 'ativo' }).eq('id', existing[0].id)
    }
  } else {
    // CLIENTE NOVO nasce COMPLETO (plano + preço semanal + dia de pagamento) — senão o cron de cobrança
    // pula o cliente (exige dia_pagamento_semana != null) e a receita semanal nunca roda pra ele.
    const startIso = new Date().toISOString()
    // dia_pagamento_semana = dia-da-semana do start_date na MESMA convenção que payDueWeeks/dowOfYmd usam
    // pra LER (getUTCDay do YMD civil, 0=Dom..6=Sáb) → o cliente cobra no mesmo dia em que fechou.
    const [yy, mm, dd] = startIso.slice(0, 10).split('-').map(Number)
    const diaPagamentoSemana = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()
    // Plano efetivo: o escolhido no fechamento (planoId) OU, sem escolha, o default que o app já usa hoje
    // (1º plano ATIVO por ordem = "Start"/US$140, mesmo valor-padrão do resolveClientPlan). NÃO inventa plano.
    // plan_weekly SEMPRE = valor_semanal DESSE plano (nunca 0); plano_id e plan_weekly apontam pro MESMO plano.
    let novoPlanoId: string | null = null
    let novoPlanWeekly = 0
    // AVULSO tem precedência e NÃO cai no fallback do plano padrão: plano_id fica null de propósito.
    const avulso = customWeeklyUsd != null && customWeeklyUsd > 0 ? customWeeklyUsd : null
    if (avulso) novoPlanWeekly = avulso
    else if (planoId) {
      let planQuery = supabase.from('plans').select('id, valor_semanal').eq('id', planoId)
      if (teamId) planQuery = planQuery.eq('team_id', teamId)
      const { data: pl } = await planQuery.maybeSingle()
      if (pl) { novoPlanoId = pl.id as string; novoPlanWeekly = Number(pl.valor_semanal) || 0 }
    }
    if (!avulso && (!novoPlanoId || novoPlanWeekly <= 0)) {
      let defaultPlanQuery = supabase.from('plans').select('id, valor_semanal').eq('ativo', true)
      if (teamId) defaultPlanQuery = defaultPlanQuery.eq('team_id', teamId)
      const { data: def } = await defaultPlanQuery.order('ordem', { ascending: true, nullsFirst: false }).order('valor_semanal').limit(1).maybeSingle()
      if (def) { novoPlanoId = def.id as string; novoPlanWeekly = Number(def.valor_semanal) || 0 }
    }
    const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
      name: lead.name, email: lead.email ?? null, phone: lead.phone ?? null, company: lead.company ?? null,
      // Geografia HERDADA do lead (LEAD-GEO-001) — MESMAS colunas; o cliente nasce no mesmo local, sem re-detecção.
      city: lead.city ?? null, state: lead.state ?? null, area_code: lead.area_code ?? null,
      plano_id: novoPlanoId, plan_weekly: novoPlanWeekly, status: 'ativo',
      dia_pagamento_semana: diaPagamentoSemana,
      assigned_to: lead.assigned_to ?? null, assigned_name: lead.assigned_name ?? null,
      start_date: startIso,
      ...(teamId ? { team_id: teamId } : {}),
    }).select('id').single()
    if (clientErr) notes.push({ message: `Lead movido, mas falhou ao cadastrar o cliente: ${clientErr.message}`, type: 'error' })
    else clientId = newClient?.id ?? null
  }

  // GUARDA: sem cliente vinculado NÃO criamos o deal — deal órfão (client_id null) quebra a
  // derivação da comissão. Avisa (não falha silencioso) e para aqui.
  if (!clientId) {
    console.error('[runWonFlow] client_id nulo — venda NÃO criada para evitar deal órfão', { lead: lead.name })
    notes.push({ message: 'Lead movido, mas NÃO lancei a comissão: não consegui vincular o cliente. Cadastre o cliente e lance a venda manualmente.', type: 'error' })
    return notes
  }

  // PLANO AVULSO no cliente (PLANO-AVULSO-001) — aqui, e não dentro do bloco de comissão: o cliente pode JÁ
  // existir (reusado por nome acima, sem passar pela criação) e o responsável pode não gerar comissão. Plano é
  // do CLIENTE; comissão é do VENDEDOR. Sem isto, a 1ª semana de receita usaria o plano antigo do cliente.
  if (customWeeklyUsd != null && customWeeklyUsd > 0) {
    let upd = supabase.from('clients').update({ plano_id: null, plan_weekly: customWeeklyUsd }).eq('id', clientId)
    if (teamId) upd = upd.eq('team_id', teamId)
    const { error: planErr } = await upd
    if (planErr) notes.push({ message: `Venda criada, mas falhou ao aplicar o plano personalizado: ${planErr.message}`, type: 'error' })
  }

  // Vendedor + GERA COMISSÃO? (Parte 3). Resolve pelo RESPONSÁVEL do lead (não mais "1º ativo fixo"): Daniel
  // (dono, gera_comissao=false) = cliente + receita, SEM comissão. Sem vendedor ativo → não cria deal.
  const { sellerId, geraComissao } = await resolveSellerForCommission(supabase, lead.assigned_name, teamId)
  if (!sellerId) {
    notes.push({ message: 'Cliente cadastrado, mas não lancei a comissão: nenhum vendedor ativo configurado.', type: 'error' })
    return notes
  }

  // 2) DEAL (comissão) — SÓ se o responsável gera comissão. Daniel: pula o deal (a RECEITA da 1ª semana abaixo
  //    continua; sem deal → deriveCommission = no_deal → zero comissão). Idempotente (dedup por lead_id/nome).
  if (geraComissao) {
    const { data: deals } = await supabase.from('deals').select('id, lead_id, client_name').eq('seller_id', sellerId)
    if ((deals ?? []).some(x => x.lead_id === lead.id || x.client_name === lead.name)) return notes

    // Plano do fechamento (Fase 2A): grava no cliente + comissão/semana pelo % do plano; sem % → LEGADO US$25/sem.
    let vps = LEGACY_VPS_USD
    let pctUsed: number | null = null
    const avulsoDeal = customWeeklyUsd != null && customWeeklyUsd > 0 ? customWeeklyUsd : null
    if (avulsoDeal) {
      // Mesmo direito de comissão dos planos do catálogo: % do catálogo sobre o valor semanal avulso, nas
      // DEFAULT_TETO_SEMANAS primeiras semanas. O % é lido do catálogo (não hardcoded) p/ acompanhar a regra
      // se ela mudar; sem catálogo, cai no 20% padrão do modelo de remuneração.
      let pctQuery = supabase.from('plans').select('comissao_percentual').eq('ativo', true)
      if (teamId) pctQuery = pctQuery.eq('team_id', teamId)
      const { data: catalogo } = await pctQuery.order('ordem', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
      const pctCatalogo = catalogo?.comissao_percentual != null ? Number(catalogo.comissao_percentual) : null
      const pct = hasCommissionPct(pctCatalogo) ? pctCatalogo : 20
      pctUsed = pct
      vps = weeklyCommissionUsd(avulsoDeal, pct)
      // O cliente já recebeu plano_id null + plan_weekly avulso acima — aqui só a comissão.
    } else if (planoId) {
      let selectedPlanQuery = supabase.from('plans').select('id, valor_semanal, comissao_percentual').eq('id', planoId)
      if (teamId) selectedPlanQuery = selectedPlanQuery.eq('team_id', teamId)
      const { data: pl } = await selectedPlanQuery.maybeSingle()
      const pct = pl?.comissao_percentual != null ? Number(pl.comissao_percentual) : null
      if (pl) {
        await supabase.from('clients').update({ plano_id: pl.id, plan_weekly: pl.valor_semanal }).eq('id', clientId).eq('team_id', teamId)
        if (hasCommissionPct(pct)) { pctUsed = pct; vps = weeklyCommissionUsd(Number(pl.valor_semanal), pct) }
      }
    }
    const tetoSemanas = DEFAULT_TETO_SEMANAS
    const valorTotalUsd = Math.round(vps * tetoSemanas * 100) / 100

    const dealIns = await supabase.from('deals').insert({
      seller_id: sellerId, client_id: clientId, client_name: lead.name, lead_id: lead.id,
      valor_total_usd: valorTotalUsd, teto_semanas: tetoSemanas, valor_por_semana_usd: vps, comissao_percentual: pctUsed,
      status: 'em_andamento', data_fechamento: today, ...(teamId ? { team_id: teamId } : {}),
    }).select('id').single()
    let deal = dealIns.data
    if (dealIns.error) {
      if ((dealIns.error as { code?: string }).code === '23505') {
        const { data: ex } = await supabase.from('deals').select('id').eq('lead_id', lead.id).maybeSingle()
        deal = ex ?? null
      }
      if (!deal) { notes.push({ message: `Cliente ok, mas não foi possível lançar a comissão: ${dealIns.error.message}`, type: 'error' }); return notes }
    }
    if (!deal) { notes.push({ message: 'Cliente ok, mas não foi possível lançar a comissão.', type: 'error' }); return notes }
  }

  // 3) 1ª semana de RECEITA (client_payments) + deriva a comissão (só se houver deal). Idempotente (unique 23505).
  //    Daniel (sem deal): grava só a receita — comissão não deriva. Mesma cotação/regra de dinheiro de sempre.
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const wk1 = await payClientWeek(supabase, clientId, 1, today, resolveRate(fxc, manual ?? 0), teamId)
  if (!wk1.ok && wk1.reason === 'db') {
    notes.push({ message: `Cliente ok, mas falhou a 1ª semana: ${wk1.message ?? 'erro'}`, type: 'error' })
    return notes
  }

  notes.push({ message: geraComissao ? 'Venda registrada: comissão lançada' : 'Cliente registrado (responsável sem comissão — receita sim, comissão não).', type: 'success' })
  return notes
}

// Move um lead de estágio: persiste status + stage_changed_at e, ao ir pra "fechado",
// dispara o won-flow (comissão). NÃO faz UI — devolve resultado + notas pro chamador
// decidir como mostrar (toast no funil / texto no chat do agente).
// Comissão de reunião (mesmo valor padrão do registro manual em Comissões).
const MEETING_USD = 15

// (resolveMeetingSellerId removido — a resolução de vendedor + flag gera_comissao agora é única em
//  resolveSellerForCommission, lib/commission/actions. Parte 3.)

export async function moveLead(
  supabase: SupaClient, lead: MovableLead, newStatus: LeadStatus, userName: string, stages: FunnelStage[], planoId: string | null = null, userId: string | null = null, teamId: string | null = null, customWeeklyUsd: number | null = null,
): Promise<{ ok: boolean; error?: string; notes: ActionNote[] }> {
  if (lead.status === newStatus) return { ok: true, notes: [] }
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('leads').update({ status: newStatus, stage_changed_at: nowIso, updated_at: nowIso }).eq('id', lead.id)
  if (error) return { ok: false, error: error.message, notes: [] }
  // Histórico de movimentação do funil (ADITIVO, best-effort). Cobre TODO move que passa por aqui:
  // arrastar, botões, diário, restaurar da lixeira e o fechamento (toStage='fechado') — SEM tocar
  // em runWonFlow. fromStage = status anterior (já garantido ≠ newStatus pelo guard acima).
  await logStageEvent(supabase, {
    leadId: lead.id, leadName: lead.name,
    fromStage: lead.status, toStage: newStatus,
    sellerId: lead.assigned_to ?? null, sellerName: lead.assigned_name ?? null,
  }, teamId)
  // Marcos do ciclo (relatório) — significado lido de funnel_stages. Idempotente, NÃO mexe em comissão.
  await markMilestones(supabase, lead.id, marcosForSlug(stages, newStatus), teamId)
  // Won-flow (DINHEIRO) dispara pela FLAG is_won da fase (não por slug fixo). Comportamento idêntico.
  const won = wonSlug(stages)
  const isWon = newStatus === won && lead.status !== won

  const notes: ActionNote[] = []

  // ── COMISSÃO DE REUNIÃO (ADITIVO, dinheiro) ──────────────────────────────────────────────
  // Gatilho: AVANÇAR de 'reuniao' para 'proposta' OU para a fase is_won ('fechado'). Lança US$15
  // pro vendedor responsável REUSANDO registerMeeting (mesmo valor/cotação/formato). NÃO toca em
  // runWonFlow/calc/payWeek. Idempotente: só cria se NÃO existe nenhuma meeting com este lead_id.
  // Best-effort: falha aqui NÃO bloqueia o move. Sem backfill (só vale para esta mudança).
  // CORTE (Parte 6): a partir de JUL/2026 reunião não gera mais comissão — não cria a linha (sem US$0). A
  // fase (stage_event) do funil segue registrada acima; só a COMISSÃO de reunião é que acaba.
  if (lead.status === 'reuniao' && (newStatus === 'proposta' || newStatus === won) && meetingCommissionCounts(ymd(new Date()))) {
    try {
      const { data: jaTem } = await supabase.from('meetings').select('id').eq('lead_id', lead.id).limit(1)
      if (!jaTem || jaTem.length === 0) {
        // Parte 3: responsável sem comissão (Daniel) não gera reunião. Resolve vendedor + flag pelo responsável.
        const { sellerId, geraComissao } = await resolveSellerForCommission(supabase, lead.assigned_name, teamId)
        if (sellerId && geraComissao) {
          const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle()
          const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
          const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
          const { error: mErr } = await registerMeeting(
            supabase, sellerId,
            { metOn: ymd(new Date()), valorUsd: MEETING_USD, clientName: lead.name, leadId: lead.id },
            resolveRate(fxc, manual ?? 0), teamId,
          )
          if (!mErr) notes.push({ message: `Comissão de reunião lançada (US$ ${MEETING_USD}).`, type: 'success' })
          else console.error('[moveLead] comissão de reunião falhou ao inserir:', mErr.message)
        }
      }
    } catch (e) { console.error('[moveLead] comissão de reunião (erro inesperado):', e instanceof Error ? e.message : String(e)) }
  }

  // Atividade de mudança de fase (QUALQUER fase), mobile E desktop. O caso "won" já é registrado
  // DENTRO do runWonFlow ("...Venda Fechada") → aqui pulamos o won pra NÃO duplicar. Secundário:
  // best-effort, NÃO bloqueia o move nem a comissão se falhar.
  if (!isWon) {
    const destName = stages.find(s => s.slug === newStatus)?.nome
      ?? ALL_COLUMNS.find(c => c.key === newStatus)?.label ?? newStatus
    try {
      await supabase.from('activities').insert({
        type: 'lead',
        description: `Lead ${lead.name} movido para ${destName}`,
        user_name: userName,
        user_id: userId,
        entity_id: lead.id,
        ...(teamId ? { team_id: teamId } : {}),
      })
    } catch { /* registrar atividade é secundário — não quebra o move */ }
  }
  // ── TAREFA AUTOMÁTICA DA FASE (FUNIL-TAREFA-001) ─────────────────────────────────────────
  // Mover o lead para "Reunião Agendada" (e demais fases com próximo passo) registrava a fase e a
  // comissão, mas não criava tarefa — a reunião nunca aparecia na Minha Mesa. Agora entra na fila.
  // IDEMPOTENTE por tipo: se já existe tarefa ABERTA do mesmo tipo para o lead, não duplica (mover
  // de um lado pro outro não empilha). Best-effort: falha aqui NÃO bloqueia o move.
  // A data nasce HOJE porque o funil não pergunta quando — é o que faz a tarefa aparecer na hora;
  // o horário real se ajusta no editor da tarefa (ou pelo "Registrar contato", que pede data e hora).
  const stageTask = isWon ? null : stageTaskFor(newStatus)
  const taskOwner = userId ?? lead.assigned_to ?? null
  if (stageTask && taskOwner) {
    try {
      const { data: aberta } = await supabase.from('tasks')
        .select('id').eq('linked_type', 'lead').eq('linked_id', lead.id)
        .eq('kind', stageTask.kind).eq('done', false).limit(1)
      if (!aberta || aberta.length === 0) {
        const { error: tErr } = await supabase.from('tasks').insert({
          title: stageTask.title(lead.name),
          kind: stageTask.kind,
          done: false,
          due_date: spToday(),
          linked_type: 'lead',
          linked_id: lead.id,
          linked_name: lead.name,
          user_id: taskOwner,
          responsavel_id: DEFAULT_TASK_OWNER_ID,
          responsavel_nome: DEFAULT_TASK_OWNER_NAME,
          ...(teamId ? { team_id: teamId } : {}),
        })
        if (!tErr) notes.push({ message: `Tarefa criada: ${stageTask.title(lead.name)} (hoje — ajuste a data/hora se precisar).`, type: 'success' })
        else console.error('[moveLead] tarefa da fase falhou ao inserir:', tErr.message)
      }
    } catch (e) { console.error('[moveLead] tarefa da fase (erro inesperado):', e instanceof Error ? e.message : String(e)) }
  }

  if (isWon) notes.push(...await runWonFlow(supabase, lead, userName, planoId, teamId, customWeeklyUsd))
  return { ok: true, notes }
}
