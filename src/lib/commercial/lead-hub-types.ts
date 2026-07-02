// Modelos do HUB DO LEAD (LEAD-001). Tipos puros (sem 'server-only'): compartilhados server↔UI.
// O Hub é o centro da operação comercial — reúne perfil, timeline universal, estatísticas e pipeline.

export type LeadTimelineType =
  | 'observacao' | 'fase' | 'reuniao' | 'no_show' | 'reagendamento'
  | 'proposta' | 'fechamento' | 'perda' | 'upgrade' | 'renovacao'
  | 'responsavel' | 'arquivo' | 'comentario' | 'atividade'

// Um item da timeline: tipo, autor, quando, título e descrição. Ícone/cor são derivados do tipo na UI.
export type LeadTimelineItem = {
  id: string
  type: LeadTimelineType
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

export type LeadPipelineStep = {
  slug: string
  stage: string
  enteredAt: string | null
  durationDays: number | null
  movedBy: string | null
  current: boolean
}

// Placeholders preparados para virar automação (Próxima ação) e upload (Arquivos) — sem implementar agora.
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
  timeline: LeadTimelineItem[]
  pipeline: LeadPipelineStep[]
  files: LeadFileRef[]     // vazio nesta fase (estrutura pronta)
}
