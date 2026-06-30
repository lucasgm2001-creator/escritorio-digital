// Tipos do andar "Clientes". Client reaproveita o tipo já existente (mesma tabela `clients`).
export type { Client } from './ClientesClient'

// Prateleira (nicho) — tabela `nichos`. A prateleira de um cliente = clients.nicho == nichos.nome.
export interface Nicho {
  id: string
  nome: string
  cor: string | null
  posicao: number
  ativo: boolean
  created_at: string
}

// Integração de automação (WhatsApp/Z-API) por cliente — tabela `client_integrations` (UNIQUE client_id).
export interface ClientIntegration {
  id: string
  client_id: string
  ativo: boolean
  instancia: string | null
  numero_destino: string | null
  template: string | null
  landing_pages: string[]
  created_at: string
  updated_at: string
}

// Plano pelo valor semanal (US$). 140=Start, 190=Growth, 250=Escalate. Fora disso, mostra o valor.
export function planLabel(weekly: number | null | undefined): string {
  const w = Number(weekly) || 0
  if (w >= 250) return 'Escalate'
  if (w >= 190) return 'Growth'
  if (w >= 140) return 'Start'
  return w > 0 ? `US$ ${w}` : '—'
}

// Saúde do cliente (indicador simples por status). ativo=ok, prospect=atenção, inativo=encerrado.
export type Health = 'ok' | 'warn' | 'off'
export function healthOf(status: string): { level: Health; label: string; dot: string } {
  if (status === 'ativo') return { level: 'ok', label: 'Ativo', dot: 'bg-[#22C55E]' }
  if (status === 'prospect') return { level: 'warn', label: 'Prospect', dot: 'bg-amber-500' }
  return { level: 'off', label: 'Encerrado', dot: 'bg-bento-muted' }
}
