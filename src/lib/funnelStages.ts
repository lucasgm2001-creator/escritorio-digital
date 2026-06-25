import { ALL_COLUMNS, type ColumnConfig } from '@/app/(dashboard)/comercial/types'
import type { createClient } from '@/lib/supabase/client'

type SupaClient = ReturnType<typeof createClient>

export type Marco = 'interagiu' | 'reuniao' | 'fechou'

export interface FunnelStage {
  slug: string
  nome: string
  posicao: number
  is_won: boolean
  is_lost: boolean
  is_system: boolean
  conta_interagiu: boolean
  conta_reuniao: boolean
  conta_fechou: boolean
  cor: string | null
  arquivada: boolean
  grupo: string | null              // seção do editor (Captação/Qualificação/…); texto livre
  dias_esfriamento: number | null   // limite de "esfriando" (vermelho) da fase; null = padrão global
}

// Fase PROTEGIDA (trava dura): nome/cor/grupo/posicao/dias_esfriamento OK; excluir e mexer em
// slug/is_won/is_lost/is_system/conta_reuniao/conta_fechou são PROIBIDOS. Casa novo/reuniao/proposta/
// fechado/perdido/lixeira. O editor NUNCA escreve as flags de dinheiro.
export function isStageProtected(s: FunnelStage): boolean {
  return s.is_system || s.is_won || s.is_lost || s.conta_reuniao || s.conta_fechou || s.slug === 'reuniao'
}

export type StageRole = 'ganho' | 'perdido' | 'arquivo' | 'ativo'
// Papel DERIVADO das flags (o editor não escreve is_won/is_lost; só liga/desliga arquivada em comuns).
export function stageRole(s: FunnelStage): StageRole {
  if (s.is_won) return 'ganho'
  if (s.is_lost) return 'perdido'
  if (s.arquivada) return 'arquivo'
  return 'ativo'
}

// Fallback estático = o mapa de hoje. Garante comportamento IDÊNTICO se as fases do banco não
// carregarem — e protege o won-flow/marcos (DINHEIRO) contra falha de rede.
const FALLBACK_MARCOS: Record<string, Marco[]> = {
  interagiu: ['interagiu'], reuniao: ['interagiu'], no_show: ['interagiu'],
  reagendamento: ['interagiu'], proposta: ['interagiu', 'reuniao'],
  fechado: ['interagiu', 'reuniao', 'fechou'],
}

// Slug da fase de "ganhou"/"perdeu". Fallback aos slugs de sistema (estáveis) se faltar.
export function wonSlug(stages: FunnelStage[]): string {
  return stages.find(s => s.is_won)?.slug ?? 'fechado'
}
export function lostSlug(stages: FunnelStage[]): string {
  return stages.find(s => s.is_lost)?.slug ?? 'perdido'
}

// Marcos do estágio: lê conta_* da fase; cai no mapa estático se a fase não veio do banco.
export function marcosForSlug(stages: FunnelStage[], slug: string): Marco[] {
  const st = stages.find(s => s.slug === slug)
  if (!st) return FALLBACK_MARCOS[slug] ?? []
  const m: Marco[] = []
  if (st.conta_interagiu) m.push('interagiu')
  if (st.conta_reuniao) m.push('reuniao')
  if (st.conta_fechou) m.push('fechou')
  return m
}

// ── Render: funde a fase do banco (nome/ordem/flags) com o ESTILO atual por slug ──
const STYLE_BY_SLUG: Record<string, ColumnConfig> = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c]))

export function toColumnConfig(stage: FunnelStage): ColumnConfig {
  // Cor/rotting/grupo da fase viajam junto p/ o funil refletir (indicador, deal-rotting, seção).
  const extra = { cor: stage.cor ?? null, coldDays: stage.dias_esfriamento ?? null, grupo: stage.grupo ?? null }
  const base = STYLE_BY_SLUG[stage.slug]
  if (base) return { ...base, label: stage.nome, ...extra }   // estilo idêntico ao de hoje; nome do banco
  // Fase nova (incremento 2): estilo neutro.
  return {
    key: stage.slug as ColumnConfig['key'], label: stage.nome, tier: stage.posicao, tone: 'neutral',
    textColor: 'text-bento-text', bgColor: 'bg-bento-bg', dotColor: 'bg-bento-muted', borderColor: 'border-bento-border',
    ...extra,
  }
}

// Colunas do funil (não-arquivadas, por posicao). Vazio → cai no estático (idêntico a hoje).
export function columnsFromStages(stages: FunnelStage[]): ColumnConfig[] {
  if (!stages || stages.length === 0) return ALL_COLUMNS
  return [...stages].filter(s => !s.arquivada).sort((a, b) => a.posicao - b.posicao).map(toColumnConfig)
}
export function tiersFromColumns(cols: ColumnConfig[]): ColumnConfig[][] {
  const tiers = Array.from(new Set(cols.map(c => c.tier))).sort((a, b) => a - b)
  return tiers.map(t => cols.filter(c => c.tier === t))
}

// ── Client: carrega as fases uma vez por sessão (memoizado). Falha → [] (consumidores
//    caem nos fallbacks → comportamento idêntico). ──
let _cache: FunnelStage[] | null = null
let _inflight: Promise<FunnelStage[]> | null = null
export async function loadStages(supabase: SupaClient): Promise<FunnelStage[]> {
  if (_cache) return _cache
  if (!_inflight) {
    _inflight = (async () => {
      try {
        const { data } = await supabase.from('funnel_stages').select('*').order('posicao')
        _cache = (data ?? []) as FunnelStage[]
        return _cache
      } catch {
        return [] as FunnelStage[]
      }
    })()
  }
  return _inflight
}
