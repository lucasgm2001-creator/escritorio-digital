// Modelos do HUB DO LEAD (LEAD-001 + LEAD-002). Tipos puros (sem 'server-only'): compartilhados server↔UI.
// O Hub é o centro da operação comercial — perfil, timeline universal, saúde, painel executivo e jornada.

export type LeadTimelineType =
  | 'observacao' | 'fase' | 'reuniao' | 'no_show' | 'reagendamento'
  | 'proposta' | 'fechamento' | 'perda' | 'upgrade' | 'renovacao'
  | 'responsavel' | 'arquivo' | 'comentario' | 'atividade'

// Categorias visuais (LEAD-002).
export type LeadCategory =
  | 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'negociacao'
  | 'problema' | 'informacao' | 'importante' | 'contrato' | 'estrategia'

// Origem do registro: manual (pessoa), automação, sistema, IA (futuro).
export type LeadTimelineOrigin = 'manual' | 'automacao' | 'sistema' | 'ia'

export type LeadTimelineItem = {
  id: string
  type: LeadTimelineType
  category: LeadCategory
  origin: LeadTimelineOrigin
  author: string | null
  at: string | null       // ISO
  title: string
  description: string | null
}

export type LeadStats = {
  daysAsLead: number
  daysStuck: number
  contacts: number
  meetings: number
  proposals: number
  observations: number
  movements: number
}

// Lead Health (LEAD-002): painel de saúde do lead.
export type LeadHealth = {
  daysStuck: number
  daysInStage: number
  lastContactAt: string | null
  lastMeetingAt: string | null
  lastProposalAt: string | null
  movements: number
  observations: number
  meetings: number
  proposals: number
  contacts: number
}

// Painel Executivo (LEAD-002): indicadores rápidos. score é real; chance é placeholder (IA/forecast futuro).
export type LeadTemperature = 'quente' | 'morno' | 'frio'
export type LeadExecutive = {
  score: number | null
  chance: number | null
  temperature: LeadTemperature
  status: string | null
  avgDaysPerStage: number | null
  lastActivityAt: string | null
}

// Linha do tempo visual (LEAD-002): jornada Lead → Cliente.
export type LeadJourneyStep = { key: string; label: string; done: boolean; at: string | null }

export type LeadPipelineStep = {
  slug: string
  stage: string
  enteredAt: string | null
  durationDays: number | null
  movedBy: string | null
  current: boolean
}

export type LeadFileKind = 'pdf' | 'imagem' | 'contrato' | 'proposta' | 'documento'
export type LeadFileRef = { id: string; name: string; kind: LeadFileKind }

export type LeadHubVM = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  origem: string | null
  nicho: string | null
  responsavel: string | null
  stageSlug: string | null
  stageName: string | null
  expectedValue: number | null
  createdAt: string | null
  receivedAt: string | null
  stageChangedAt: string | null
  nextContact: string | null
  notes: string | null
  stats: LeadStats
  health: LeadHealth
  executive: LeadExecutive
  journey: LeadJourneyStep[]
  timeline: LeadTimelineItem[]
  pipeline: LeadPipelineStep[]
  files: LeadFileRef[]
}
