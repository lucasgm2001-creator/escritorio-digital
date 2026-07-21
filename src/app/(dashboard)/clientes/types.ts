// Tipos do andar "Clientes" (tabela `clients`). Client mora AQUI (módulo compartilhado) — antes vinha do
// ClientesClient.tsx (removido). Importado pelo andar, pelo Comercial (mapTypes/LeadModal/Contatos) e por
// ClienteModal/DossieTab.
export interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  plan_weekly: number
  plano_id?: string | null
  dia_pagamento_semana?: number | null   // dia-da-semana de cobrança (0=Dom..6=Sáb), MESMA convenção do cron/payDueWeeks
  periodicidade?: 'semanal' | 'mensal'    // forma de cobrança (F2). Motor é sempre semanal; 'mensal' = paga o mês de uma vez.
  forma_pagamento?: string | null         // método (PIX/cartão/transferência...) — só cadastro (Parte 2, migration 054)
  status: 'ativo' | 'inativo' | 'prospect'
  start_date?: string
  billing_anchor_date?: string | null   // primeira semana paga; ancora a recorrência sem alterar o início do contrato
  end_date?: string
  assigned_name?: string
  nicho?: string
  fuso?: 'leste' | 'central' | 'montanha' | 'pacifico' | null
  city?: string | null        // cidade (EUA) — Mapa de Clientes
  state?: string | null       // estado (EUA), sigla de 2 letras — Mapa de Clientes
  area_code?: string | null   // DDD (area code) — Mapa de Clientes
  jobs?: string[]
  created_at: string
  drive_folder_url?: string | null
  dossie?: Record<string, { url?: string; notas?: string }> | null
}

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
