export type LeadStatus = 'novo' | 'interagiu' | 'reuniao' | 'proposta' | 'fechado' | 'nao_interagiu' | 'perdido'

export interface Lead {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  value: number
  status: LeadStatus
  score: number
  operation: 'brasil' | 'eua'
  assigned_to?: string
  assigned_name?: string
  notes?: string
  nicho?: string
  origem?: 'instagram' | 'google' | 'indicacao' | 'tiktok' | 'site' | 'outro'
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente'
  next_contact?: string
  last_contact_at?: string
  created_at: string
}

export interface ColumnConfig {
  key: LeadStatus
  label: string
  textColor: string
  bgColor: string
  dotColor: string
  borderColor: string
}

export const MAIN_FLOW: ColumnConfig[] = [
  { key: 'novo',      label: 'Novo Lead',   textColor: 'text-blue-600',    bgColor: 'bg-blue-50',    dotColor: 'bg-blue-500',    borderColor: 'border-blue-200' },
  { key: 'interagiu', label: 'Interagiu',   textColor: 'text-indigo-600',  bgColor: 'bg-indigo-50',  dotColor: 'bg-indigo-500',  borderColor: 'border-indigo-200' },
  { key: 'reuniao',   label: 'Reunião',     textColor: 'text-purple-600',  bgColor: 'bg-purple-50',  dotColor: 'bg-purple-500',  borderColor: 'border-purple-200' },
  { key: 'proposta',  label: 'Proposta',    textColor: 'text-amber-600',   bgColor: 'bg-amber-50',   dotColor: 'bg-amber-500',   borderColor: 'border-amber-200' },
  { key: 'fechado',   label: 'Venda Feita', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500', borderColor: 'border-emerald-200' },
]

export const SECONDARY_FLOW: (ColumnConfig & { parentIndex: number })[] = [
  { key: 'nao_interagiu', label: 'Não Interagiu', textColor: 'text-slate-500',  bgColor: 'bg-slate-50',  dotColor: 'bg-slate-400',  borderColor: 'border-slate-200', parentIndex: 1 },
  { key: 'perdido',       label: 'Venda Perdida', textColor: 'text-rose-600',   bgColor: 'bg-rose-50',   dotColor: 'bg-rose-500',   borderColor: 'border-rose-200',  parentIndex: 3 },
]

export const ALL_COLUMNS: ColumnConfig[] = [...MAIN_FLOW, ...SECONDARY_FLOW]
