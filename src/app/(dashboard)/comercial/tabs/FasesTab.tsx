'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronUp, ChevronDown, ChevronRight, GripVertical, Plus, Lock, Trash2, X, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { isStageProtected, stageRole, type FunnelStage, type StageRole } from '@/lib/funnelStages'
import { cn } from '@/lib/utils'

const NO_GROUP = 'Sem grupo'
// Paleta de cores das fases (hex gravado em `cor`).
const PALETTE = ['#C2F73A', '#22C55E', '#38BDF8', '#6366F1', '#A78BFA', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#94A3B8']
const ROLE_LABEL: Record<StageRole, string> = { ganho: 'Ganho', perdido: 'Perdido', arquivo: 'Arquivo', ativo: 'Ativo' }
const ROLE_CLS: Record<StageRole, string> = {
  ganho: 'text-green-400 border-green-800/50', perdido: 'text-red-400 border-red-800/50',
  arquivo: 'text-bento-muted border-bento-border', ativo: 'text-lime-fg border-lime/40',
}

// nome → slug estável (sem acento/espaço). O slug NUNCA muda no renomear → nenhum lead muda de fase.
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Agrupa as fases por `grupo` (null → "Sem grupo"). Ordem dos grupos = pela MENOR posição (1º visto,
// já que iteramos ordenado por posicao). Dentro do grupo, por posicao.
function buildGroups(stages: FunnelStage[]): { name: string; items: FunnelStage[] }[] {
  const map = new Map<string, FunnelStage[]>()
  for (const s of [...stages].sort((a, b) => a.posicao - b.posicao)) {
    const g = (s.grupo && s.grupo.trim()) || NO_GROUP
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(s)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
}

// Editor PROFISSIONAL do funil (funnel_stages). O editor SÓ escreve: nome, cor, grupo, posicao,
// dias_esfriamento, conta_interagiu, arquivada — e cria/exclui conforme regras. NUNCA escreve
// slug/is_won/is_lost/is_system/conta_reuniao/conta_fechou em fase existente (DINHEIRO intocado).
export function FasesTab() {
  const supabase = createClient()
  const { toast } = useToast()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selSlug, setSelSlug] = useState<string | null>(null)
  const [newFase, setNewFase] = useState('')
  const [newFaseGroup, setNewFaseGroup] = useState('')
  const [delState, setDelState] = useState<{ stage: FunnelStage; dest: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('funnel_stages').select('*').order('posicao')
    setStages((data ?? []) as FunnelStage[])
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => buildGroups(stages), [stages])
  const groupNames = useMemo(() => groups.map(g => g.name).filter(n => n !== NO_GROUP), [groups])
  const sel = selSlug ? stages.find(s => s.slug === selSlug) ?? null : null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Persiste uma ordem PLANA (slug + grupo) → grava posicao (índice+1) e grupo só nas linhas que mudaram.
  const persist = async (ordered: { slug: string; grupo: string | null }[]) => {
    setStages(prev => ordered.map((o, i) => ({ ...prev.find(p => p.slug === o.slug)!, posicao: i + 1, grupo: o.grupo })))
    for (let i = 0; i < ordered.length; i++) {
      const o = ordered[i]; const orig = stages.find(s => s.slug === o.slug); const pos = i + 1
      if (orig && (orig.posicao !== pos || (orig.grupo ?? null) !== (o.grupo ?? null))) {
        await supabase.from('funnel_stages').update({ posicao: pos, grupo: o.grupo }).eq('slug', o.slug)
      }
    }
  }

  // Arrastar fase: reordena dentro do grupo OU entra noutro grupo (soltando sobre um card de lá).
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const flat = buildGroups(stages).flatMap(g => g.items.map(s => ({ slug: s.slug, grupo: g.name === NO_GROUP ? null : g.name })))
    const from = flat.findIndex(f => f.slug === active.id)
    if (from < 0) return
    const targetGroup = flat.find(f => f.slug === over.id)?.grupo ?? null
    const [moved] = flat.splice(from, 1)
    moved.grupo = targetGroup
    const to = flat.findIndex(f => f.slug === over.id)
    flat.splice(to < 0 ? flat.length : to, 0, moved)
    await persist(flat)
  }

  // Reordenar GRUPO inteiro (sobe/desce o bloco).
  const moveGroup = async (name: string, dir: -1 | 1) => {
    const gs = buildGroups(stages); const idx = gs.findIndex(g => g.name === name); const j = idx + dir
    if (j < 0 || j >= gs.length) return
    ;[gs[idx], gs[j]] = [gs[j], gs[idx]]
    await persist(gs.flatMap(g => g.items.map(s => ({ slug: s.slug, grupo: g.name === NO_GROUP ? null : g.name }))))
  }

  const renameGroup = async (oldName: string) => {
    const nome = window.prompt(`Renomear grupo "${oldName}" para:`, oldName === NO_GROUP ? '' : oldName)?.trim()
    if (nome == null) return
    const next = nome || null
    setBusy(true)
    for (const s of stages.filter(s => ((s.grupo && s.grupo.trim()) || NO_GROUP) === oldName)) {
      await supabase.from('funnel_stages').update({ grupo: next }).eq('slug', s.slug)
    }
    setBusy(false); load()
  }

  // Move uma fase p/ outro grupo (combobox do painel) — posicao no FIM (não bagunça a ordem).
  const moveToGroup = async (slug: string, grupoRaw: string) => {
    const grupo = grupoRaw.trim() || null
    const posicao = Math.max(0, ...stages.map(s => s.posicao)) + 1
    setStages(prev => prev.map(s => s.slug === slug ? { ...s, grupo, posicao } : s))
    await supabase.from('funnel_stages').update({ grupo, posicao }).eq('slug', slug)
  }

  // Patch de colunas PERMITIDAS apenas (nunca flags de dinheiro).
  const patchStage = async (slug: string, patch: Partial<Pick<FunnelStage, 'nome' | 'cor' | 'dias_esfriamento' | 'conta_interagiu' | 'arquivada'>>) => {
    setStages(prev => prev.map(s => s.slug === slug ? { ...s, ...patch } : s))
    const { error } = await supabase.from('funnel_stages').update(patch).eq('slug', slug)
    if (error) { toast({ type: 'error', message: `Não foi possível salvar: ${error.message}` }); load() }
  }

  const criar = async () => {
    const nome = newFase.trim(); if (!nome || busy) return
    let slug = slugify(nome); if (!slug) { toast({ type: 'error', message: 'Nome inválido.' }); return }
    if (stages.some(s => s.slug === slug)) slug = `${slug}_${Date.now().toString().slice(-4)}`
    setBusy(true)
    const posicao = Math.max(0, ...stages.map(s => s.posicao)) + 1
    // Fase nova NEUTRA: nada de dinheiro (is_won/is_lost/is_system false; reuniao/fechou false).
    const { error } = await supabase.from('funnel_stages').insert({
      slug, nome, posicao, grupo: newFaseGroup.trim() || null, dias_esfriamento: null, cor: null,
      is_won: false, is_lost: false, is_system: false, conta_interagiu: true, conta_reuniao: false, conta_fechou: false, arquivada: false,
    })
    setBusy(false)
    if (error) { toast({ type: 'error', message: `Não foi possível criar a fase: ${error.message}` }); return }
    setNewFase(''); load()
  }

  // Excluir-mesclar: move os leads do slug antigo → destino ANTES de apagar (nunca órfão). NÃO toca stage_events.
  const confirmDelete = async () => {
    if (!delState) return
    const { stage, dest } = delState
    if (isStageProtected(stage)) { toast({ type: 'error', message: 'Fase protegida não pode ser excluída.' }); return }
    if (!dest || dest === stage.slug) { toast({ type: 'error', message: 'Escolha a fase de destino dos leads.' }); return }
    setBusy(true)
    const { error: e1 } = await supabase.from('leads').update({ status: dest }).eq('status', stage.slug)
    if (e1) { setBusy(false); toast({ type: 'error', message: `Falha ao mover leads: ${e1.message}` }); return }
    const { error: e2 } = await supabase.from('funnel_stages').delete().eq('slug', stage.slug)
    setBusy(false)
    if (e2) { toast({ type: 'error', message: `Falha ao excluir: ${e2.message}` }); return }
    setDelState(null); setSelSlug(null); load()
    toast({ type: 'success', message: 'Fase excluída e leads movidos.' })
  }

  return (
    <div className="space-y-4 max-w-2xl font-body">
      <div>
        <h2 className="font-display font-bold text-bento-text text-base">Fases do funil</h2>
        <p className="text-bento-muted text-xs mt-0.5">Agrupe, arraste pra reordenar e clique numa fase pra editar. Renomear muda só o rótulo — o identificador interno é preservado, então nenhum lead muda de fase. Fases protegidas (cadeado) não podem ser excluídas.</p>
      </div>

      {/* Criar fase (nome + grupo opcional) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={newFase} onChange={e => setNewFase(e.target.value)} onKeyDown={e => e.key === 'Enter' && criar()}
          placeholder="Nova fase (ex.: Negócio Futuro)"
          className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[44px]" />
        <input list="grupos-list" value={newFaseGroup} onChange={e => setNewFaseGroup(e.target.value)}
          placeholder="Grupo (opcional)"
          className="sm:w-44 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[44px]" />
        <button onClick={criar} disabled={busy || !newFase.trim()}
          className="bento-btn flex items-center justify-center gap-1.5 px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]"><Plus className="w-4 h-4" />Criar</button>
      </div>
      <datalist id="grupos-list">{groupNames.map(n => <option key={n} value={n} />)}</datalist>

      {loading ? (
        <p className="text-sm text-bento-muted">Carregando...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="space-y-3">
            {groups.map((g, gi) => {
              const isClosed = collapsed.has(g.name)
              return (
                <div key={g.name} className="bento-fx p-2">
                  {/* Cabeçalho do grupo: colapsar + nome + contagem + renomear + reordenar grupo */}
                  <div className="flex items-center gap-1.5 px-1.5 py-1">
                    <button onClick={() => setCollapsed(p => { const n = new Set(p); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n })}
                      className="p-1 text-bento-muted hover:text-bento-text" aria-label="Colapsar grupo">
                      <ChevronRight className={cn('w-4 h-4 transition-transform', !isClosed && 'rotate-90')} />
                    </button>
                    <span className="font-tech text-[11px] uppercase tracking-[0.12em] text-bento-dim flex-1 truncate">{g.name}</span>
                    <span className="font-tech text-[10px] text-bento-muted tabular-nums">{g.items.length}</span>
                    <button onClick={() => renameGroup(g.name)} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Renomear grupo" title="Renomear grupo"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveGroup(g.name, -1)} disabled={gi === 0 || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Subir grupo"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveGroup(g.name, 1)} disabled={gi === groups.length - 1 || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Descer grupo"><ChevronDown className="w-4 h-4" /></button>
                  </div>

                  {!isClosed && (
                    <SortableContext items={g.items.map(s => s.slug)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5 pt-1">
                        {g.items.map(s => (
                          <SortableFase key={s.slug} stage={s} selected={selSlug === s.slug} onSelect={setSelSlug} />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              )
            })}
          </div>
        </DndContext>
      )}

      {/* Painel de edição da fase selecionada */}
      {sel && (
        <StagePanel
          key={sel.slug}
          stage={sel}
          onClose={() => setSelSlug(null)}
          onPatch={patchStage}
          onMoveGroup={moveToGroup}
          onArchive={(archived) => patchStage(sel.slug, { arquivada: archived })}
          onAskDelete={() => setDelState({ stage: sel, dest: '' })}
        />
      )}

      {/* Excluir-mesclar: escolher destino dos leads */}
      {delState && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDelState(null)} />
          <div className="relative w-full max-w-sm bg-bento-panel border border-bento-border rounded-bento shadow-card-hover p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-bento-text">Excluir “{delState.stage.nome}”</h3>
              <button onClick={() => setDelState(null)} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-bento-muted">Os leads desta fase serão movidos para a fase escolhida ANTES de excluir (nenhum lead fica órfão). O histórico não é apagado.</p>
            <select value={delState.dest} onChange={e => setDelState(d => d && { ...d, dest: e.target.value })}
              className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime">
              <option value="">Mover leads para…</option>
              {stages.filter(s => s.slug !== delState.stage.slug).map(s => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDelState(null)} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={busy || !delState.dest} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Mover e excluir</button>
            </div>
          </div>
        </div>
      )}

      <p className="font-tech text-[11px] text-bento-muted/70">Mudanças aparecem no funil ao recarregar. Fases de venda/perda/sistema são protegidas (cadeado) e não afetam dinheiro por aqui.</p>
    </div>
  )
}

// ── Linha arrastável da fase (handle = grip; corpo seleciona p/ editar) ──
function SortableFase({ stage, selected, onSelect }: { stage: FunnelStage; selected: boolean; onSelect: (slug: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.slug })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const prot = isStageProtected(stage)
  const role = stageRole(stage)
  return (
    <div ref={setNodeRef} style={style} {...attributes} onClick={() => onSelect(stage.slug)}
      className={cn('flex items-center gap-2 bg-bento-bg border rounded-md p-2.5 cursor-pointer transition-colors', selected ? 'border-lime/60' : 'border-bento-border hover:border-lime/40')}>
      <button {...listeners} onClick={e => e.stopPropagation()} aria-label="Arrastar" className="cursor-grab touch-none text-bento-muted hover:text-bento-text shrink-0"><GripVertical className="w-4 h-4" /></button>
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: stage.cor || '#64748b' }} />
      <span className="flex-1 text-sm text-bento-text truncate">{stage.nome}</span>
      {prot && <Lock className="w-3.5 h-3.5 text-bento-muted shrink-0" />}
      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0', ROLE_CLS[role])}>{ROLE_LABEL[role]}</span>
    </div>
  )
}

// ── Painel de edição de UMA fase ──
function StagePanel({ stage, onClose, onPatch, onMoveGroup, onArchive, onAskDelete }: {
  stage: FunnelStage
  onClose: () => void
  onPatch: (slug: string, patch: Partial<Pick<FunnelStage, 'nome' | 'cor' | 'dias_esfriamento' | 'conta_interagiu'>>) => void
  onMoveGroup: (slug: string, grupo: string) => void
  onArchive: (archived: boolean) => void
  onAskDelete: () => void
}) {
  const prot = isStageProtected(stage)
  const role = stageRole(stage)
  const [nome, setNome] = useState(stage.nome)
  const [grupo, setGrupo] = useState(stage.grupo ?? '')
  const [dias, setDias] = useState(stage.dias_esfriamento != null ? String(stage.dias_esfriamento) : '')

  return (
    <div className="bento-fx p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-bento-text text-sm flex items-center gap-2">{prot && <Lock className="w-3.5 h-3.5 text-bento-muted" />}Editar fase</h3>
        <button onClick={onClose} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Nome</label>
        <input value={nome} onChange={e => setNome(e.target.value)} onBlur={() => nome.trim() && nome !== stage.nome && onPatch(stage.slug, { nome: nome.trim() })}
          className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
        <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Identificador interno (slug): {stage.slug} — não muda no renomear.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Cor</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PALETTE.map(c => (
            <button key={c} onClick={() => onPatch(stage.slug, { cor: c })} aria-label={`Cor ${c}`}
              className={cn('w-6 h-6 rounded-full border-2 transition-transform', stage.cor === c ? 'border-bento-text scale-110' : 'border-transparent')}
              style={{ backgroundColor: c }} />
          ))}
          <button onClick={() => onPatch(stage.slug, { cor: null })} className="text-[10px] text-bento-muted hover:text-bento-text px-1.5">limpar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Grupo</label>
          <input list="grupos-list" value={grupo} onChange={e => setGrupo(e.target.value)} onBlur={() => (grupo.trim() || '') !== (stage.grupo ?? '') && onMoveGroup(stage.slug, grupo)}
            placeholder="Sem grupo" className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
        </div>
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Esfria em (dias)</label>
          <input type="number" min="2" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value)}
            onBlur={() => onPatch(stage.slug, { dias_esfriamento: dias.trim() === '' ? null : Math.max(2, Number(dias) || 5) })}
            placeholder="padrão (5)" className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
        </div>
      </div>

      {/* Papel — protegido = read-only (cadeado); comum = alterna Ativo/Arquivo (arquivada). */}
      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Papel</label>
        {prot ? (
          <div className="flex items-center gap-2 text-sm text-bento-muted"><Lock className="w-3.5 h-3.5" /><span className={cn('px-2 py-0.5 rounded-full border text-xs font-semibold', ROLE_CLS[role])}>{ROLE_LABEL[role]}</span><span className="text-[11px]">protegida (somente leitura)</span></div>
        ) : (
          <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 w-max">
            {([['ativo', 'Ativo'], ['arquivo', 'Arquivo']] as [StageRole, string][]).map(([v, l]) => (
              <button key={v} onClick={() => onArchive(v === 'arquivo')}
                className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors', role === v ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Conta como interação (conta_interagiu) — relatório, não comissão. */}
      <button onClick={() => onPatch(stage.slug, { conta_interagiu: !stage.conta_interagiu })}
        className="flex items-center justify-between w-full text-sm text-bento-text">
        <span>Conta como interação</span>
        <span className={cn('relative w-10 h-6 rounded-full transition-colors', stage.conta_interagiu ? 'bg-lime' : 'bg-bento-border')}>
          <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', stage.conta_interagiu && 'translate-x-4')} />
        </span>
      </button>

      {/* Excluir — só em fase NÃO protegida (obriga mover leads). */}
      {!prot && (
        <button onClick={onAskDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-3.5 h-3.5" />Excluir fase (move os leads)</button>
      )}
    </div>
  )
}
