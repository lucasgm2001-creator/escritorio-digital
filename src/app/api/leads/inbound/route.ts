import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stateToFuso } from '@/lib/fuso'
import { logStageEvent } from '@/lib/stageEvents'
import { US_STATES } from '@/lib/usStates'
import usMap from '@/data/us-map.json'
import { areaCodeFromPhone } from '@/lib/leadIntake'

// Webhook PÚBLICO — o Magnetic (GoHighLevel) chama a cada lead novo e nós inserimos no funil
// (tabela `leads`), com os MESMOS defaults de um lead criado à mão. Sem sessão de usuário → usamos
// o client service-role (createServiceClient). Protegido por segredo compartilhado.
//
// Mapeamento (PROMPT 28): cada campo do formulário vai pra COLUNA certa (não mais tudo em notes):
//   nome→name, empresa(SÓ o nome)→company, email→email, telefone→phone, serviço/tipo→nicho,
//   valor/orçamento→value, mensagem→notes (texto limpo). Geografia US (city/state/area_code) vem
//   do DDD do telefone (sinal CONFIÁVEL de EUA) via us-map.json; o "Estado" do formulário só
//   sobrescreve se for um estado US VÁLIDO (no form ele às vezes é o estado BRASILEIRO da pessoa).
//   O PAYLOAD INTEIRO é gravado em raw_payload (jsonb) → nada do formulário se perde.
//
// origem: a constraint leads_origem_check já foi liberada p/ aceitar 'magnetic', então gravamos
// origem='magnetic' direto. A fonte/payload completo segue também em raw_payload.
//
// Envs esperadas:
//   - INBOUND_WEBHOOK_SECRET   (segredo compartilhado; header "x-webhook-secret" ou ?secret=)
//   - NEXT_PUBLIC_SUPABASE_URL  +  SUPABASE_SERVICE_ROLE_KEY  (lidas dentro de createServiceClient)

export const runtime = 'nodejs'

// Vendedor responsável padrão dos leads do Magnetic (perfil "Lucas"; FK profiles validada).
const ASSIGNED_TO = '623dd724-ddeb-426c-956a-4c71f6653fa5'
const ASSIGNED_NAME = 'Lucas'

// TENANCY do webhook (BUGFIX-MAGNETIC-FUNNEL-STAGE): sem sessão não há activeTeamId, então a equipe dona dos
// leads de entrada é resolvida AQUI, explicitamente. Prioridade: env INBOUND_TEAM_ID (config por deploy — o
// "provider connection com team_id" de hoje); sem ela, o default DOCUMENTADO é a DR Growth (para onde 100% do
// inbound sempre foi — operação interna). NUNCA gravamos team_id null. Antes, o insert não setava team_id e
// dependia do trigger set_team_id_default(), que só carimba a equipe quando existe UMA no sistema; ao surgir a
// 2ª equipe (multi-tenant/TEAM-001) o fallback parou, os leads passaram a nascer órfãos (team_id null) e
// sumiram do funil/Hall/Comercial (toda query é .eq('team_id', ...)). Config: setar INBOUND_TEAM_ID no Vercel.
const DEFAULT_INBOUND_TEAM_ID = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'   // DR Growth
const INBOUND_TEAM_ID = process.env.INBOUND_TEAM_ID?.trim() || DEFAULT_INBOUND_TEAM_ID

const AREA_CODES = (usMap as { areaCodes: Record<string, { st: string; city: string }> }).areaCodes
const US_CODE = new Set(US_STATES.map(s => s.code))
const US_NAME_TO_CODE = new Map(US_STATES.map(s => [s.name.toLowerCase(), s.code]))

// Compara o segredo em tempo constante (sha256 garante buffers do mesmo tamanho). Nunca loga o segredo.
function secretOk(req: Request): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET
  if (!expected) return false
  const provided =
    req.headers.get('x-webhook-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    ''
  if (!provided) return false
  return timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(expected).digest(),
  )
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim())

// Achata TODOS os pares chave→valor do payload (incluindo aninhados em customData/customFields/
// custom_fields do GHL) num mapa case-insensitive. 1ª ocorrência não-vazia vence.
function flattenCI(body: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>()
  const eat = (obj: unknown) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) { eat(v); continue }
      const key = k.toLowerCase(); const val = str(v)
      if (val && !out.has(key)) out.set(key, val)
    }
  }
  eat(body)
  return out
}
// 1º valor não-vazio entre as chaves pedidas (case-insensitive).
function pick(map: Map<string, string>, keys: string[]): string {
  for (const k of keys) { const v = map.get(k.toLowerCase()); if (v) return v }
  return ''
}

// "NC" | "north carolina" → "NC"; lixo / estado BRASILEIRO (MG, GO…) → '' (não é estado US).
function normalizeUsState(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const up = s.toUpperCase()
  if (up.length === 2 && US_CODE.has(up)) return up
  return US_NAME_TO_CODE.get(s.toLowerCase()) ?? ''
}

// (DDD do telefone US: areaCodeFromPhone importado de @/lib/leadIntake, que DELEGA à fonte única
//  lib/geo/phone-geo — LEAD-GEO-001. Sem cópia inline aqui.)

// Valor/orçamento: aceita US ("1,234.56") E BR ("1.234,56"). O ÚLTIMO separador é o decimal;
// os demais são milhar. Sem número → 0.
function parseValue(raw: string): number {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return 0
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')   // vírgula decimal (BR)
  else s = s.replace(/,/g, '')                                          // ponto decimal (US)
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Heurística: parece ENDEREÇO (não nome de empresa)? CEP US (com \b → nome com 5 dígitos não cai)
// ou logradouro → sim. Evita endereço caindo na coluna company.
function looksLikeAddress(s: string): boolean {
  if (/\b\d{5}(?:-\d{4})?\b/.test(s)) return true
  return /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|way|lane|ln|court|ct|hwy)\b/i.test(s)
}

// Fase INICIAL oficial do funil DA EQUIPE (fonte de verdade = funnel_stages): menor posição entre as fases
// não-ganhas / não-perdidas / não-arquivadas. Fallback seguro 'novo' (fase de sistema) se a leitura falhar ou
// a equipe ainda não tiver funil próprio. Assim o lead nasce SEMPRE numa coluna real do Kanban (nunca invisível).
async function resolveInitialStage(supabase: SupabaseClient, teamId: string): Promise<string> {
  const { data } = await supabase
    .from('funnel_stages')
    .select('slug')
    .eq('team_id', teamId)
    .eq('is_won', false)
    .eq('is_lost', false)
    .eq('arquivada', false)
    .order('posicao', { ascending: true })
    .limit(1)
  return data?.[0]?.slug || 'novo'
}

// Tarefa automática de LIGAÇÃO para o lead novo (INBOUND-ACTION-001). Best-effort: uma falha aqui NUNCA pode
// perder o lead (já criado/retornado). Anti-duplicidade: não recria se já houver uma ligação pendente do dia
// para o MESMO lead (linked_id + done=false + due_date de hoje + título "Ligar para…"). Só o webhook chama
// isto — lead MANUAL não passa por aqui, logo segue sem task automática. Responsável = dono do lead (owner
// DR Growth), com user_id de profile válido → a tarefa aparece no Hall/Tarefas dele. Não sincroniza Google
// Agenda (insert direto; o sync roda só pelas actions da UI), então add_call=true é só o tipo "ligação".
async function createCallTask(supabase: SupabaseClient, leadId: string, leadName: string, teamId: string, now: Date): Promise<void> {
  try {
    const today = now.toISOString().slice(0, 10)
    const { data: dup } = await supabase.from('tasks').select('id')
      .eq('linked_type', 'lead').eq('linked_id', leadId).eq('done', false)
      .eq('due_date', today).ilike('title', 'Ligar para%').limit(1)
    if (dup && dup.length) return
    await supabase.from('tasks').insert({
      user_id: ASSIGNED_TO,                         // responsável do lead (owner DR Growth; FK profiles) → Hall dele
      title: `Ligar para ${leadName}`,
      due_date: today,
      due_time: now.toISOString().slice(11, 16),    // 'HH:MM' do horário de chegada do lead
      duration_min: 15,
      add_call: true,                               // tipo "ligação" (ícone telefone em Tarefas/Hall)
      is_meeting: false,                            // não é reunião/vídeo
      priority: 'normal',
      done: false,
      linked_type: 'lead', linked_id: leadId, linked_name: leadName,
      team_id: teamId,
    })
  } catch (e) {
    console.error('[leads/inbound] call task failed:', e instanceof Error ? e.message : String(e))
  }
}

// Atividade no feed (INBOUND-ACTION-001): a chegada do lead aparece em "Atividades Recentes" do Hall. Mesmo
// padrão do lead manual — type 'lead' + entity_id → card CLICÁVEL que abre o lead. Descrição própria (origem
// Magnetic) para não confundir com o "Novo lead cadastrado" do fluxo manual. Best-effort.
async function logInboundActivity(supabase: SupabaseClient, leadId: string, leadName: string, teamId: string): Promise<void> {
  try {
    await supabase.from('activities').insert({
      type: 'lead',
      description: `Novo lead recebido pelo Magnetic Funnels: ${leadName}`,
      user_name: ASSIGNED_NAME,
      entity_id: leadId,
      team_id: teamId,
    })
  } catch (e) {
    console.error('[leads/inbound] activity failed:', e instanceof Error ? e.message : String(e))
  }
}

export async function POST(req: Request) {
  // 1) SEGURANÇA antes de qualquer acesso ao banco.
  if (!secretOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // 2) Corpo.
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  // Payload bruto: log SÓ com INBOUND_DEBUG ligado (não polui o hot path nem vaza dado em prod).
  const rawStr = JSON.stringify(body)
  if (process.env.INBOUND_DEBUG) console.log('[leads/inbound] payload:', rawStr)
  // raw_payload com TETO de 64KB: payload gigante não incha a linha (guarda só um marcador).
  const RAW_MAX = 64 * 1024
  const rawPayload: unknown = rawStr.length <= RAW_MAX ? body : { _truncated: true, _bytes: rawStr.length }

  try {
    const flat = flattenCI(body)

    // 3) NOME.
    const first = str(body.first_name)
    const last = str(body.last_name)
    const name =
      str(body.full_name) ||
      [first, last].filter(Boolean).join(' ').trim() ||
      str(body.name) ||
      first

    // 4) CONTATO.
    const email = str(body.email)
    const phone = str(body.phone)

    // 5) Sem nome, e-mail e telefone → ignora (não insere).
    if (!name && !email && !phone) {
      return NextResponse.json({ ok: true, ignored: 'empty' })
    }

    // 6) EMPRESA (SÓ o nome do negócio; nunca endereço/cidade/estado).
    const companyRaw = pick(flat, [
      'company_name', 'company', 'empresa', 'business_name', 'business', 'nome_da_empresa', 'nome da empresa',
      'negocio', 'negócio', 'razao_social',
    ])
    const company = companyRaw && !looksLikeAddress(companyRaw) ? companyRaw : null

    // 7) NICHO (tipo de serviço/negócio).
    const nicho = pick(flat, [
      'nicho', 'service', 'servico', 'serviço', 'tipo_de_negocio', 'tipo de negócio', 'business_type',
      'niche', 'segmento', 'segment', 'tipo',
    ]) || null

    // 8) VALOR / ORÇAMENTO.
    const value = parseValue(pick(flat, ['value', 'valor', 'orcamento', 'orçamento', 'budget', 'investimento', 'faturamento', 'revenue']))

    // 9) MENSAGEM → notes (texto LIMPO; sem "Origem: X | Estado: Y").
    const notes = pick(flat, ['message', 'mensagem', 'observacao', 'observação', 'obs', 'comentario', 'comentário', 'comments', 'duvida', 'dúvida', 'nota']) || null

    // 10) GEOGRAFIA US — base no DDD do telefone (sinal confiável de EUA); o "Estado" do formulário
    //     só entra se for estado US VÁLIDO (no form às vezes é o estado BR da pessoa).
    const area_code = areaCodeFromPhone(phone) || null
    let state: string | null = null
    let city: string | null = null
    if (area_code && AREA_CODES[area_code]) { state = AREA_CODES[area_code].st; city = AREA_CODES[area_code].city }
    const payloadState = normalizeUsState(pick(flat, ['state', 'estado', 'uf']))
    const payloadCity = pick(flat, ['city', 'cidade', 'municipio', 'município'])
    if (payloadState) { state = payloadState; if (payloadCity) city = payloadCity }

    // 11) Fuso a partir do estado US final (não do texto cru do formulário).
    const fuso = stateToFuso(state ?? '')

    const supabase = createServiceClient()
    // Tenancy explícita + fase inicial oficial (o webhook não tem sessão). NUNCA team_id null → nunca órfão.
    const teamId = INBOUND_TEAM_ID
    const initialStage = await resolveInitialStage(supabase, teamId)
    const now = new Date()

    // 12) Dedup: já existe lead com o MESMO email OU o MESMO phone? (o que vier). Se a checagem FALHAR
    //     (erro de query), NÃO inserir às cegas — aborta com 500, senão arriscaria duplicar.
    if (email) {
      const { data, error } = await supabase.from('leads').select('id').eq('email', email).is('deleted_at', null).limit(1)
      if (error) return NextResponse.json({ ok: false, error: 'falha ao verificar duplicidade (email)' }, { status: 500 })
      if (data && data.length) return NextResponse.json({ ok: true, duplicate: true })
    }
    if (phone) {
      const { data, error } = await supabase.from('leads').select('id').eq('phone', phone).is('deleted_at', null).limit(1)
      if (error) return NextResponse.json({ ok: false, error: 'falha ao verificar duplicidade (phone)' }, { status: 500 })
      if (data && data.length) return NextResponse.json({ ok: true, duplicate: true })
    }

    // 13) Insere com os MESMOS padrões de um lead manual (status 'novo', operation 'eua', prioridade
    //     'media', score 500) + colunas mapeadas + raw_payload (payload inteiro). assigned ao Lucas.
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: name || 'Sem nome',
        email: email || null,
        phone: phone || null,
        company,
        nicho,
        city,
        state,
        area_code,
        value,
        notes,
        status: initialStage,     // fase inicial oficial do funil da equipe (nunca null/inválida → entra em "Novo Lead")
        team_id: teamId,          // BUGFIX-MAGNETIC-FUNNEL-STAGE: carimba a equipe (o trigger não cobre >1 equipe)
        operation: 'eua',
        origem: 'magnetic',       // constraint leads_origem_check liberada p/ 'magnetic' (fonte real tb em raw_payload)
        prioridade: 'media',
        score: 500,
        assigned_to: ASSIGNED_TO,
        assigned_name: ASSIGNED_NAME,
        raw_payload: rawPayload,
        ...(fuso ? { fuso } : {}),   // só seta se reconhecemos o estado US (null → não envia)
      })
      .select('id')
      .single()

    if (error) {
      // 23505 = índice único (email/phone) → lead JÁ existe; trata como duplicado, nunca 500.
      if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      console.error('[leads/inbound] insert failed:', error.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })

    // Histórico de movimentação: entrada no funil (ADITIVO/best-effort). Carimba a equipe resolvida.
    await logStageEvent(supabase, {
      leadId: data.id, leadName: name || 'Sem nome',
      fromStage: null, toStage: initialStage,
      sellerId: null, sellerName: ASSIGNED_NAME,
    }, teamId)

    // Tarefa automática de ligação p/ o lead novo (best-effort — não bloqueia a resposta do webhook).
    await createCallTask(supabase, data.id, name || 'Sem nome', teamId, now)
    // Atividade no feed do Hall (best-effort).
    await logInboundActivity(supabase, data.id, name || 'Sem nome', teamId)

    return NextResponse.json({ ok: true, leadId: data.id })
  } catch (e) {
    console.error('[leads/inbound] unexpected:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
