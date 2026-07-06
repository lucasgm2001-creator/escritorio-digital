// Sanitização do raw_payload do lead (webhook GHL/Magnetic) para "Mais informações" — extraído VERBATIM do
// LeadDiary (UI-POLISH-GIANTS-001). Funções PURAS, sem React, comportamento idêntico.

// Chaves do raw_payload que JÁ aparecem como campo dedicado → não repetir em "Mais informações".
const PAYLOAD_SKIP = new Set([
  'name', 'full_name', 'first_name', 'last_name', 'email', 'phone',
  'company', 'company_name', 'empresa', 'business', 'business_name', 'nome_da_empresa', 'negocio', 'negócio', 'razao_social',
  'nicho', 'service', 'servico', 'serviço', 'tipo', 'tipo_de_negocio', 'business_type', 'niche', 'segmento', 'segment',
  'value', 'valor', 'orcamento', 'orçamento', 'budget', 'investimento', 'faturamento', 'revenue',
  'message', 'mensagem', 'observacao', 'observação', 'obs', 'comentario', 'comentário', 'comments', 'duvida', 'dúvida', 'nota',
  'state', 'estado', 'uf', 'city', 'cidade', 'municipio', 'município',
])

// Plumbing do GHL/Magnetic que NÃO é útil pro vendedor (IDs, objetos internos, metadados).
const NOISE_KEYS = new Set([
  'id', 'contactid', 'locationid', 'userid', 'companyid', 'accountid', 'calendarid',
  'location', 'user', 'workflow', 'triggerdata', 'trigger', 'contacttype', 'contactsource',
  'attributionsource', 'datecreated', 'dateupdated', 'dateadded', 'version', 'webhook', 'webhookid', 'timestamp',
])
const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
const isNoiseKey = (k: string) => {
  const n = normKey(k)
  return NOISE_KEYS.has(n) || n.endsWith('id') || n.includes('webhook') || n.includes('workflow') || n.includes('trigger')
}
// Valor que parece ID/token (UUID ou cadeia longa sem espaço) → ruído.
const isIdValue = (v: string) => /^[a-f0-9]{8}-[a-f0-9]{4}/i.test(v) || /^[A-Za-z0-9_-]{18,}$/.test(v)

// "Mais informações" = só os campos ÚTEIS do raw_payload. Tira IDs/plumbing e objetos internos
// (location/user/workflow/triggerData…); de customData/customFields, puxa os campos legíveis.
export function usefulPayloadEntries(raw: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = []
  const consider = (k: string, v: unknown) => {
    if (isNoiseKey(k) || PAYLOAD_SKIP.has(k.toLowerCase())) return
    let val = ''
    if (v == null) return
    if (Array.isArray(v)) val = v.filter(x => typeof x !== 'object').join(', ')   // tags etc.
    else if (typeof v === 'object') return                                        // objeto interno → fora
    else val = String(v)
    val = val.trim()
    if (!val || val === '[object Object]' || isIdValue(val)) return
    out.push([k, val])
  }
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k)
    if ((nk === 'customdata' || nk === 'customfields' || nk === 'customfield') && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) consider(k2, v2)
    } else {
      consider(k, v)
    }
  }
  return out
}
