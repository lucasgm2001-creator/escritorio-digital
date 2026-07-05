import { US_STATES } from '@/lib/usStates'

// Telefone → GEOGRAFIA (CLIENT-PROFILE-GEO-001). FONTE ÚNICA da detecção: EUA (area code → estado/cidade via
// src/data/us-map.json, o MESMO mapa do dashboard) + Brasil (DDD → UF/cidade, tabela estática abaixo — é DADO de
// referência, não migration). Puro/reutilizável (ClienteModal, LeadModal...). NUNCA sobrescreve sozinho: devolve
// só uma SUGESTÃO; quem chama decide aplicar. Se não reconhecer, retorna null (não quebra nada).

// DDD do Brasil → UF + cidade principal do código. Cobre os 67 DDDs válidos.
const BRAZIL_DDD: Record<string, { uf: string; city: string }> = {
  '11': { uf: 'SP', city: 'São Paulo' }, '12': { uf: 'SP', city: 'São José dos Campos' }, '13': { uf: 'SP', city: 'Santos' },
  '14': { uf: 'SP', city: 'Bauru' }, '15': { uf: 'SP', city: 'Sorocaba' }, '16': { uf: 'SP', city: 'Ribeirão Preto' },
  '17': { uf: 'SP', city: 'São José do Rio Preto' }, '18': { uf: 'SP', city: 'Presidente Prudente' }, '19': { uf: 'SP', city: 'Campinas' },
  '21': { uf: 'RJ', city: 'Rio de Janeiro' }, '22': { uf: 'RJ', city: 'Campos dos Goytacazes' }, '24': { uf: 'RJ', city: 'Volta Redonda' },
  '27': { uf: 'ES', city: 'Vitória' }, '28': { uf: 'ES', city: 'Cachoeiro de Itapemirim' },
  '31': { uf: 'MG', city: 'Belo Horizonte' }, '32': { uf: 'MG', city: 'Juiz de Fora' }, '33': { uf: 'MG', city: 'Governador Valadares' },
  '34': { uf: 'MG', city: 'Uberlândia' }, '35': { uf: 'MG', city: 'Poços de Caldas' }, '37': { uf: 'MG', city: 'Divinópolis' }, '38': { uf: 'MG', city: 'Montes Claros' },
  '41': { uf: 'PR', city: 'Curitiba' }, '42': { uf: 'PR', city: 'Ponta Grossa' }, '43': { uf: 'PR', city: 'Londrina' },
  '44': { uf: 'PR', city: 'Maringá' }, '45': { uf: 'PR', city: 'Foz do Iguaçu' }, '46': { uf: 'PR', city: 'Francisco Beltrão' },
  '47': { uf: 'SC', city: 'Joinville' }, '48': { uf: 'SC', city: 'Florianópolis' }, '49': { uf: 'SC', city: 'Chapecó' },
  '51': { uf: 'RS', city: 'Porto Alegre' }, '53': { uf: 'RS', city: 'Pelotas' }, '54': { uf: 'RS', city: 'Caxias do Sul' }, '55': { uf: 'RS', city: 'Santa Maria' },
  '61': { uf: 'DF', city: 'Brasília' }, '62': { uf: 'GO', city: 'Goiânia' }, '63': { uf: 'TO', city: 'Palmas' }, '64': { uf: 'GO', city: 'Rio Verde' },
  '65': { uf: 'MT', city: 'Cuiabá' }, '66': { uf: 'MT', city: 'Rondonópolis' }, '67': { uf: 'MS', city: 'Campo Grande' },
  '68': { uf: 'AC', city: 'Rio Branco' }, '69': { uf: 'RO', city: 'Porto Velho' },
  '71': { uf: 'BA', city: 'Salvador' }, '73': { uf: 'BA', city: 'Itabuna' }, '74': { uf: 'BA', city: 'Juazeiro' }, '75': { uf: 'BA', city: 'Feira de Santana' },
  '77': { uf: 'BA', city: 'Barreiras' }, '79': { uf: 'SE', city: 'Aracaju' },
  '81': { uf: 'PE', city: 'Recife' }, '82': { uf: 'AL', city: 'Maceió' }, '83': { uf: 'PB', city: 'João Pessoa' }, '84': { uf: 'RN', city: 'Natal' },
  '85': { uf: 'CE', city: 'Fortaleza' }, '86': { uf: 'PI', city: 'Teresina' }, '87': { uf: 'PE', city: 'Petrolina' }, '88': { uf: 'CE', city: 'Juazeiro do Norte' }, '89': { uf: 'PI', city: 'Picos' },
  '91': { uf: 'PA', city: 'Belém' }, '92': { uf: 'AM', city: 'Manaus' }, '93': { uf: 'PA', city: 'Santarém' }, '94': { uf: 'PA', city: 'Marabá' },
  '95': { uf: 'RR', city: 'Boa Vista' }, '96': { uf: 'AP', city: 'Macapá' }, '97': { uf: 'AM', city: 'Coari' }, '98': { uf: 'MA', city: 'São Luís' }, '99': { uf: 'MA', city: 'Imperatriz' },
}

const US_STATE_NAME = new Map(US_STATES.map(s => [s.code, s.name]))

export type PhoneGeo = {
  areaCode: string
  city: string | null
  state: string | null       // sigla — EUA (MA) ou UF (RJ). Mesma coluna clients.state.
  country: 'US' | 'BR'
  label: string              // texto de sugestão pronto: "Massachusetts · região 774" / "Rio de Janeiro · RJ"
}

// ── Extração PURA e sync do código de área (FONTE ÚNICA da regra) ──────────────────────────────
// EUA: 11+ díg começando com 1 → [1..4]; 10 díg → [0..3]. Fora disso → ''. Reusado pelo webhook
// (leadIntake/inbound) e pela UI — ninguém mais reimplementa o slice (LEAD-GEO-001).
export function usAreaCodeFromDigits(digits: string): string {
  if (digits.length >= 11 && digits[0] === '1') return digits.slice(1, 4)
  if (digits.length === 10) return digits.slice(0, 3)
  return ''
}
export function usAreaCodeFromPhone(phone: string | null | undefined): string {
  return usAreaCodeFromDigits((phone ?? '').replace(/\D/g, ''))
}
// Brasil: +55 + DDD(2) + número(8–9 díg) → DDD; fora disso → ''.
export function brazilDddFromDigits(digits: string): string {
  return digits.startsWith('55') && digits.length >= 12 && digits.length <= 13 ? digits.slice(2, 4) : ''
}

// Detecta a geografia a partir do telefone. async: o mapa dos EUA (grande) é carregado sob demanda.
export async function resolvePhoneGeo(phone: string | null | undefined): Promise<PhoneGeo | null> {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null

  // BRASIL primeiro (55 + DDD): DDD reconhecido → sugere; DDD inválido → null.
  const ddd = brazilDddFromDigits(digits)
  if (ddd) {
    const br = BRAZIL_DDD[ddd]
    return br ? { areaCode: ddd, city: br.city, state: br.uf, country: 'BR', label: `${br.city} · ${br.uf}` } : null
  }

  // EUA (mesma extração do webhook via usAreaCodeFromDigits).
  const ac = usAreaCodeFromDigits(digits)
  if (!ac) return null

  const mod = await import('@/data/us-map.json')
  const entry = (mod.default as { areaCodes: Record<string, { st: string; city: string }> }).areaCodes[ac]
  if (entry) return { areaCode: ac, city: entry.city, state: entry.st, country: 'US', label: `${US_STATE_NAME.get(entry.st) ?? entry.st} · região ${ac}` }
  // Area code válido mas sem cidade mapeada: sugere só o código (honesto — não inventa cidade/estado).
  return { areaCode: ac, city: null, state: null, country: 'US', label: `Região ${ac} (EUA)` }
}
