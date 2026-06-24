import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { stateToFuso } from '@/lib/fuso'
import { logStageEvent } from '@/lib/stageEvents'
import { US_STATES } from '@/lib/usStates'
import usMap from '@/data/us-map.json'

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

// DDD a partir do telefone US (+1). 11+ díg. começando com 1 → [1..3]; 10 díg. → [0..2]. (Mesma
// regra do ClienteModal/PROMPT 17.)
function areaCodeFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11 && digits[0] === '1') return digits.slice(1, 4)
  if (digits.length === 10) return digits.slice(0, 3)
  return ''
}

// Valor/orçamento (formato US best-effort): vírgula = milhar, ponto = decimal. Sem número → 0.
function parseValue(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  if (!cleaned) return 0
  const n = Number(cleaned.replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Heurística: parece ENDEREÇO (não nome de empresa)? CEP US ou logradouro → sim. Evita endereço
// caindo na coluna company (bug do mapeamento antigo).
function looksLikeAddress(s: string): boolean {
  if (/\d{5}(?:-\d{4})?/.test(s)) return true
  return /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|way|lane|ln|court|ct|hwy)\b/i.test(s)
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
  // Loga o payload BRUTO (pra confirmarmos os nomes reais dos campos do GHL). NUNCA loga segredo/keys.
  console.log('[leads/inbound] payload:', JSON.stringify(body))

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

    // 12) Dedup: já existe lead com o MESMO email OU o MESMO phone? (o que vier)
    if (email) {
      const { data } = await supabase.from('leads').select('id').eq('email', email).limit(1)
      if (data && data.length) return NextResponse.json({ ok: true, duplicate: true })
    }
    if (phone) {
      const { data } = await supabase.from('leads').select('id').eq('phone', phone).limit(1)
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
        status: 'novo',
        operation: 'eua',
        origem: 'magnetic',       // constraint leads_origem_check liberada p/ 'magnetic' (fonte real tb em raw_payload)
        prioridade: 'media',
        score: 500,
        assigned_to: ASSIGNED_TO,
        assigned_name: ASSIGNED_NAME,
        raw_payload: body,
        ...(fuso ? { fuso } : {}),   // só seta se reconhecemos o estado US (null → não envia)
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[leads/inbound] insert failed:', error?.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    // Histórico de movimentação: entrada no funil (ADITIVO/best-effort).
    await logStageEvent(supabase, {
      leadId: data.id, leadName: name || 'Sem nome',
      fromStage: null, toStage: 'novo',
      sellerId: null, sellerName: ASSIGNED_NAME,
    })

    return NextResponse.json({ ok: true, leadId: data.id })
  } catch (e) {
    console.error('[leads/inbound] unexpected:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
