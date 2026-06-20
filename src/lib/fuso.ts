// Fuso horário PREDOMINANTE de cada estado dos EUA — usado para preencher leads.fuso
// automaticamente a partir do estado que chega no payload (sigla de 2 letras OU nome completo).
// Valores internos: 'leste' | 'central' | 'montanha' | 'pacifico'. Não reconhecido → null.
// Alaska e Hawaii têm fusos próprios (fora do escopo) → null de propósito.

export type Fuso = 'leste' | 'central' | 'montanha' | 'pacifico'

// Sigla (2 letras) → fuso predominante. DC entra no Leste.
const ABBR_TO_FUSO: Record<string, Fuso> = {
  // Leste (Eastern)
  CT: 'leste', DE: 'leste', FL: 'leste', GA: 'leste', IN: 'leste', KY: 'leste',
  ME: 'leste', MD: 'leste', MA: 'leste', MI: 'leste', NH: 'leste', NJ: 'leste',
  NY: 'leste', NC: 'leste', OH: 'leste', PA: 'leste', RI: 'leste', SC: 'leste',
  TN: 'leste', VT: 'leste', VA: 'leste', WV: 'leste', DC: 'leste',
  // Central
  AL: 'central', AR: 'central', IL: 'central', IA: 'central', KS: 'central',
  LA: 'central', MN: 'central', MS: 'central', MO: 'central', NE: 'central',
  ND: 'central', OK: 'central', SD: 'central', TX: 'central', WI: 'central',
  // Montanha (Mountain)
  AZ: 'montanha', CO: 'montanha', ID: 'montanha', MT: 'montanha',
  NM: 'montanha', UT: 'montanha', WY: 'montanha',
  // Pacífico (Pacific)
  CA: 'pacifico', NV: 'pacifico', OR: 'pacifico', WA: 'pacifico',
  // Alaska (AK) / Hawaii (HI): intencionalmente ausentes → null.
}

// Nome completo (normalizado) → sigla. AK/HI incluídos só pra serem reconhecidos e caírem em null.
const NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC', 'washington dc': 'DC',
}

// Minúsculas, sem pontos/vírgulas, espaços colapsados, sem espaços nas pontas.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

export function stateToFuso(state: string): Fuso | null {
  const n = normalize(state ?? '')
  if (!n) return null
  // Sigla de 2 letras (ex.: "fl", "ma", "dc").
  if (/^[a-z]{2}$/.test(n)) return ABBR_TO_FUSO[n.toUpperCase()] ?? null
  // Nome completo.
  const abbr = NAME_TO_ABBR[n]
  if (abbr) return ABBR_TO_FUSO[abbr] ?? null
  return null
}
