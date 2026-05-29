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
  { key: 'novo',      label: 'Novo Lead',   textColor: 'text-blue-400',    bgColor: 'bg-blue-900/20',    dotColor: 'bg-blue-500',    borderColor: 'border-blue-800/40' },
  { key: 'interagiu', label: 'Interagiu',   textColor: 'text-indigo-400',  bgColor: 'bg-indigo-900/20',  dotColor: 'bg-indigo-500',  borderColor: 'border-indigo-800/40' },
  { key: 'reuniao',   label: 'Reunião',     textColor: 'text-purple-400',  bgColor: 'bg-purple-900/20',  dotColor: 'bg-purple-500',  borderColor: 'border-purple-800/40' },
  { key: 'proposta',  label: 'Proposta',    textColor: 'text-amber-400',   bgColor: 'bg-amber-900/20',   dotColor: 'bg-amber-500',   borderColor: 'border-amber-800/40' },
  { key: 'fechado',   label: 'Venda Feita', textColor: 'text-emerald-400', bgColor: 'bg-emerald-900/20', dotColor: 'bg-emerald-500', borderColor: 'border-emerald-800/40' },
]

export const SECONDARY_FLOW: (ColumnConfig & { parentIndex: number })[] = [
  { key: 'nao_interagiu', label: 'Não Interagiu', textColor: 'text-slate-400', bgColor: 'bg-slate-800/30', dotColor: 'bg-slate-500', borderColor: 'border-slate-700/40', parentIndex: 1 },
  { key: 'perdido',       label: 'Venda Perdida', textColor: 'text-rose-400',  bgColor: 'bg-rose-900/20',  dotColor: 'bg-rose-500',  borderColor: 'border-rose-800/40',  parentIndex: 3 },
]

export const ALL_COLUMNS: ColumnConfig[] = [...MAIN_FLOW, ...SECONDARY_FLOW]
