import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'
import type { createClient } from '@/lib/supabase/client'
import type { LeadStatus } from './types'

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
}

// Fluxo de "ganhou" (lead → Venda Fechada): atividade + cliente (idempotente, reativa
// se inativo) + LANÇA o deal de comissão (+1ª semana paga). Idempotente: não duplica se
// o lead sair e voltar (dedup por lead_id, com fallback client_name+seller).
// Extraído do KanbanBoard pra ser reusado pelo agente do Hall — MESMA lógica, sem duplicar.
export async function runWonFlow(supabase: SupaClient, lead: MovableLead, userName: string): Promise<ActionNote[]> {
  const notes: ActionNote[] = []
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  await supabase.from('activities').insert({
    type: 'lead',
    description: `Lead ${lead.name} movido para Venda Fechada`,
    user_name: userName,
    entity_id: lead.id,
  })

  // 1) Cliente idempotente: reusa se já existe (por nome); senão cria. Reativa se inativo.
  let clientId: string | null = null
  const { data: existing } = await supabase.from('clients').select('id, status').eq('name', lead.name).limit(1)
  if (existing && existing.length) {
    clientId = existing[0].id
    if (existing[0].status !== 'ativo') {
      await supabase.from('clients').update({ status: 'ativo' }).eq('id', existing[0].id)
    }
  } else {
    const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
      name: lead.name, email: lead.email ?? null, phone: lead.phone ?? null, company: lead.company ?? null,
      plan_weekly: 0, status: 'ativo',
      assigned_to: lead.assigned_to ?? null, assigned_name: lead.assigned_name ?? null,
      start_date: new Date().toISOString(),
    }).select('id').single()
    if (clientErr) notes.push({ message: `Lead movido, mas falhou ao cadastrar o cliente: ${clientErr.message}`, type: 'error' })
    else clientId = newClient?.id ?? null
  }

  // Vendedor ativo (hoje só o Lucas); fallback pro id conhecido.
  const { data: sellers } = await supabase.from('sellers').select('id').eq('status', 'ativo').limit(1)
  const sellerId = sellers?.[0]?.id ?? 'd129ace7-424b-4434-88af-baa3781cb568'

  // 2) Deal idempotente: não cria se já existe deal deste lead (lead_id) ou mesmo
  //    client_name+seller (cobre deals antigos sem lead_id). Evita comissão dobrada.
  const { data: deals } = await supabase.from('deals').select('id, lead_id, client_name').eq('seller_id', sellerId)
  if ((deals ?? []).some(x => x.lead_id === lead.id || x.client_name === lead.name)) return notes

  const { data: deal, error: dealErr } = await supabase.from('deals').insert({
    seller_id: sellerId, client_id: clientId, client_name: lead.name, lead_id: lead.id,
    valor_total_usd: 100, teto_semanas: 4, valor_por_semana_usd: 25,
    status: 'em_andamento', data_fechamento: today,
  }).select('id').single()
  if (dealErr || !deal) {
    notes.push({ message: `Cliente ok, mas não foi possível lançar a comissão: ${dealErr?.message ?? 'erro'}`, type: 'error' })
    return notes
  }

  // 3) 1ª semana já paga, com a cotação vigente (mesma lógica do registro manual).
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const { error: wkErr } = await supabase.from('weekly_payments').insert({
    deal_id: deal.id, numero_semana: 1, valor_usd: 25, paid_on: today, cotacao_usd_brl: resolveRate(fxc, manual ?? 0),
  })
  if (wkErr) { notes.push({ message: `Deal criado, mas falhou a 1ª semana: ${wkErr.message}`, type: 'error' }); return notes }

  notes.push({ message: 'Venda registrada: comissão lançada', type: 'success' })
  return notes
}

// Move um lead de estágio: persiste status + stage_changed_at e, ao ir pra "fechado",
// dispara o won-flow (comissão). NÃO faz UI — devolve resultado + notas pro chamador
// decidir como mostrar (toast no funil / texto no chat do agente).
export async function moveLead(
  supabase: SupaClient, lead: MovableLead, newStatus: LeadStatus, userName: string,
): Promise<{ ok: boolean; error?: string; notes: ActionNote[] }> {
  if (lead.status === newStatus) return { ok: true, notes: [] }
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('leads').update({ status: newStatus, stage_changed_at: nowIso, updated_at: nowIso }).eq('id', lead.id)
  if (error) return { ok: false, error: error.message, notes: [] }
  const notes = (newStatus === 'fechado' && lead.status !== 'fechado') ? await runWonFlow(supabase, lead, userName) : []
  return { ok: true, notes }
}
