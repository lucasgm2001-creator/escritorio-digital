'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn, formatDate } from '@/lib/utils'
import {
  Upload, Search, Plus, Play, X, ChevronUp, ChevronDown, Trash2, Pencil,
  GripVertical, FileText, FolderOpen, Layers,
} from 'lucide-react'
import { PresentationPlayer, MaterialFrame } from './PresentationPlayer'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB — mesmo limite do bucket "materiais"
const COLS = 'id, name, storage_path, url, mime_type, size_bytes, created_at'
const PRES_COLS = 'id, name, lead_id, items, created_at, updated_at'
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

interface Material {
  id: string
  name: string
  storage_path: string
  url: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}
interface Lead { id: string; name: string }
interface Presentation {
  id: string
  name: string
  lead_id: string | null
  items: string[]            // ids dos materiais, EM ORDEM
  created_at: string
  updated_at: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`
  return `${bytes} B`
}
const isImage = (m: { mime_type: string | null }) => (m.mime_type ?? '').startsWith('image/')
const isPdf = (m: { mime_type: string | null }) => (m.mime_type ?? '') === 'application/pdf'

function TypeBadge({ m }: { m: Material }) {
  if (isPdf(m)) return <span className="font-tech text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(239,68,68,0.15)] text-[#F87171]">PDF</span>
  if (isImage(m)) return <span className="font-tech text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(96,165,250,0.15)] text-[#60A5FA]">IMG</span>
  return <span className="font-tech text-[10px] font-bold px-1.5 py-0.5 rounded bg-bento-bg text-bento-muted">FILE</span>
}

// Miniatura: imagem real ou ícone por tipo (PDF vermelho).
function Thumb({ m, className }: { m: Material; className?: string }) {
  if (isImage(m)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.url} alt="" className={cn('object-cover bg-bento-bg', className)} />
  }
  return (
    <div className={cn('flex items-center justify-center bg-bento-bg', className)}>
      <FileText className={cn('w-1/2 h-1/2', isPdf(m) ? 'text-[#F87171]' : 'text-bento-muted')} />
    </div>
  )
}

// Slide arrastável (aba Montar). Handle = grip; resto fica livre p/ os controles.
function SortableSlide({ id, index, total, m, onUp, onDown, onRemove }: {
  id: string; index: number; total: number; m: Material
  onUp: () => void; onDown: () => void; onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="flex items-center gap-2 bg-bento-bg border border-bento-border rounded-md p-2">
      <button {...listeners} aria-label="Arrastar" className="cursor-grab touch-none text-bento-muted hover:text-bento-text shrink-0">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="font-tech text-[11px] font-bold text-lime-fg tabular-nums w-5 text-center shrink-0">{String(index + 1).padStart(2, '0')}</span>
      <Thumb m={m} className="w-9 h-9 rounded shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-bento-text truncate">{m.name}</p>
        <p className="font-tech text-[10px] text-bento-muted">{fmtSize(m.size_bytes)}</p>
      </div>
      <button onClick={onUp} disabled={index === 0} aria-label="Subir" className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30 shrink-0"><ChevronUp className="w-4 h-4" /></button>
      <button onClick={onDown} disabled={index === total - 1} aria-label="Descer" className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30 shrink-0"><ChevronDown className="w-4 h-4" /></button>
      <button onClick={onRemove} aria-label="Remover" className="p-1 text-red-400 hover:text-red-300 shrink-0"><X className="w-4 h-4" /></button>
    </div>
  )
}

export function ApresentacaoTab() {
  const { toast } = useToast()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const [view, setView] = useState<'materiais' | 'montar' | 'apresentar'>('materiais')
  const [loading, setLoading] = useState(true)

  // Materiais
  const [materials, setMaterials] = useState<Material[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [presenting, setPresenting] = useState<Material | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'pdf' | 'imagem'>('todos')

  // Montar / Apresentações
  const [leads, setLeads] = useState<Lead[]>([])
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [presError, setPresError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', leadId: '' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [savingPres, setSavingPres] = useState(false)
  const [confirmingPresId, setConfirmingPresId] = useState<string | null>(null)
  const [deletingPresId, setDeletingPresId] = useState<string | null>(null)

  // Player
  const [playing, setPlaying] = useState<{ name: string; client: string | null; materials: Material[] } | null>(null)

  const matById = new Map(materials.map(m => [m.id, m]))
  const leadName = (id: string | null) => (id ? leads.find(l => l.id === id)?.name ?? null : null)

  useEffect(() => {
    const load = async () => {
      const [matRes, leadRes, presRes] = await Promise.all([
        supabase.from('presentation_materials').select(COLS).order('created_at', { ascending: false }),
        supabase.from('leads').select('id, name').order('name'),
        supabase.from('presentations').select(PRES_COLS).order('created_at', { ascending: false }),
      ])
      if (matRes.error) {
        setFetchError(matRes.error.code === '42P01'
          ? 'Tabela presentation_materials não encontrada. Rode a migration 018 no Supabase.'
          : `Erro ao carregar materiais: ${matRes.error.message}`)
      } else { setMaterials((matRes.data ?? []) as Material[]); setFetchError(null) }
      setLeads((leadRes.data ?? []) as Lead[])
      if (presRes.error) {
        setPresError(presRes.error.code === '42P01'
          ? 'Tabela presentations não encontrada. Rode a migration 019 no Supabase.'
          : `Erro ao carregar apresentações: ${presRes.error.message}`)
      } else { setPresentations((presRes.data ?? []) as Presentation[]); setPresError(null) }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Materiais: upload / excluir ────────────────────────────────────────────
  const handleFiles = async (fileList: FileList) => {
    const picked = Array.from(fileList)
    if (picked.length === 0) return
    const tooBig = picked.filter(f => f.size > MAX_BYTES)
    const valid = picked.filter(f => f.size <= MAX_BYTES)
    if (tooBig.length) {
      toast({ type: 'error', message: tooBig.length === 1
        ? `"${tooBig[0].name}" passa de 50 MB e não foi enviado.`
        : `${tooBig.length} arquivos passam de 50 MB e não foram enviados.` })
    }
    if (valid.length === 0) return
    setUploading(true)
    const uploaded: Material[] = []
    for (const file of valid) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${crypto.randomUUID()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('materiais').upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (upErr) { toast({ type: 'error', message: `Falha ao enviar "${file.name}": ${upErr.message}` }); continue }
      const { data: { publicUrl } } = supabase.storage.from('materiais').getPublicUrl(path)
      const { data, error } = await supabase.from('presentation_materials')
        .insert({ name: file.name, storage_path: path, url: publicUrl, mime_type: file.type || null, size_bytes: file.size })
        .select(COLS).single()
      if (error || !data) {
        await supabase.storage.from('materiais').remove([path])
        toast({ type: 'error', message: `Falha ao salvar "${file.name}": ${error?.message ?? 'erro'}` })
        continue
      }
      uploaded.push(data as Material)
    }
    if (uploaded.length) {
      setMaterials(prev => [...uploaded.reverse(), ...prev])
      toast({ type: 'success', message: uploaded.length === 1 ? 'Material enviado.' : `${uploaded.length} materiais enviados.` })
    }
    setUploading(false)
  }
  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (!uploading) handleFiles(e.dataTransfer.files)
  }
  const handleDelete = async (m: Material) => {
    setDeletingId(m.id)
    const { error } = await supabase.from('presentation_materials').delete().eq('id', m.id)
    if (error) { toast({ type: 'error', message: `Não foi possível excluir: ${error.message}` }); setDeletingId(null); return }
    await supabase.storage.from('materiais').remove([m.storage_path])
    setMaterials(prev => prev.filter(x => x.id !== m.id))
    setSelectedIds(prev => prev.filter(id => id !== m.id))
    setConfirmingId(null); setDeletingId(null)
    toast({ type: 'success', message: 'Material excluído.' })
  }

  // ─── Montar: rascunho / salvar ──────────────────────────────────────────────
  const openNew = () => { setEditingId(null); setForm({ name: '', leadId: '' }); setSelectedIds([]); setView('montar') }
  const openPresentation = (p: Presentation) => {
    setEditingId(p.id)
    setForm({ name: p.name, leadId: p.lead_id ?? '' })
    setSelectedIds((p.items ?? []).filter(id => matById.has(id)))
    setView('montar')
  }
  const addToSelection = (id: string) => setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  const removeFromSelection = (id: string) => setSelectedIds(prev => prev.filter(x => x !== id))
  const move = (index: number, dir: -1 | 1) => setSelectedIds(prev => {
    const j = index + dir
    if (j < 0 || j >= prev.length) return prev
    const arr = [...prev]
    ;[arr[index], arr[j]] = [arr[j], arr[index]]
    return arr
  })
  const onSlideDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setSelectedIds(prev => {
      const oldI = prev.indexOf(active.id as string)
      const newI = prev.indexOf(over.id as string)
      return oldI < 0 || newI < 0 ? prev : arrayMove(prev, oldI, newI)
    })
  }

  const savePresentation = async () => {
    const name = form.name.trim()
    if (!name) { toast({ type: 'error', message: 'Dê um nome à apresentação.' }); return }
    if (selectedIds.length === 0) { toast({ type: 'error', message: 'Adicione pelo menos um material.' }); return }
    setSavingPres(true)
    const payload = { name, lead_id: form.leadId || null, items: selectedIds }
    if (editingId) {
      const { data, error } = await supabase.from('presentations')
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId).select(PRES_COLS).single()
      if (error || !data) { toast({ type: 'error', message: `Não foi possível salvar: ${error?.message ?? 'erro'}` }); setSavingPres(false); return }
      setPresentations(prev => prev.map(p => (p.id === editingId ? (data as Presentation) : p)))
      toast({ type: 'success', message: 'Apresentação atualizada.' })
    } else {
      const { data, error } = await supabase.from('presentations').insert(payload).select(PRES_COLS).single()
      if (error || !data) { toast({ type: 'error', message: `Não foi possível salvar: ${error?.message ?? 'erro'}` }); setSavingPres(false); return }
      setPresentations(prev => [data as Presentation, ...prev])
      setEditingId((data as Presentation).id)
      toast({ type: 'success', message: 'Apresentação salva.' })
    }
    setSavingPres(false)
    setView('apresentar')
  }

  const deletePresentation = async (p: Presentation) => {
    setDeletingPresId(p.id)
    const { error } = await supabase.from('presentations').delete().eq('id', p.id)
    if (error) { toast({ type: 'error', message: `Não foi possível excluir: ${error.message}` }); setDeletingPresId(null); return }
    setPresentations(prev => prev.filter(x => x.id !== p.id))
    setConfirmingPresId(null); setDeletingPresId(null)
    toast({ type: 'success', message: 'Apresentação excluída.' })
  }

  // ─── Player ─────────────────────────────────────────────────────────────────
  const startPresent = (p: Presentation) => {
    const mats = (p.items ?? []).map(id => matById.get(id)).filter(Boolean) as Material[]
    if (mats.length === 0) { toast({ type: 'error', message: 'Esta apresentação não tem materiais disponíveis para apresentar.' }); return }
    setPlaying({ name: p.name, client: leadName(p.lead_id), materials: mats })
  }
  const filteredMaterials = materials.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'pdf') return isPdf(m)
    if (filter === 'imagem') return isImage(m)
    return true
  })

  const TABS = [
    { key: 'materiais' as const, label: 'Materiais', Icon: FolderOpen, count: materials.length },
    { key: 'montar' as const, label: 'Montar', Icon: Layers, count: selectedIds.length },
    { key: 'apresentar' as const, label: 'Apresentar', Icon: Play, count: presentations.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="px-4 sm:px-6 pt-4 shrink-0">
        <div className="flex items-center gap-1 border-b border-bento-border">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setView(t.key)}
              className={cn('flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                view === t.key ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text')}>
              <t.Icon className="w-4 h-4" />
              {t.label}
              <span className={cn('font-tech text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
                view === t.key ? 'bg-lime/15 text-lime-fg' : 'bg-bento-bg text-bento-muted')}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <input ref={inputRef} type="file" multiple accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg" className="hidden" onChange={pickFiles} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-bento-muted text-sm">Carregando...</div>
      ) : view === 'materiais' ? (
        /* ═══ MATERIAIS ═══ */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2">
              <h3 className="font-display font-bold text-bento-text text-lg">Materiais</h3>
              <span className="font-tech text-xs text-bento-muted">{materials.length} arquivo{materials.length === 1 ? '' : 's'}</span>
            </div>
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="bento-btn flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold disabled:opacity-50">
              <Upload className="w-4 h-4" />{uploading ? 'Enviando...' : 'Upload'}
            </button>
          </div>

          {/* Toolbar: busca + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-bento-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar materiais..."
                className="w-full bg-bento-bg border border-bento-border rounded-btn pl-8 pr-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
            </div>
            <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1">
              {(['todos', 'pdf', 'imagem'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                    filter === f ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                  {f === 'todos' ? 'Todos' : f === 'pdf' ? 'PDF' : 'Imagem'}
                </button>
              ))}
            </div>
          </div>

          {fetchError && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{fetchError}</div>}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMaterials.map(m => (
              <div key={m.id} className="group relative bento-fx overflow-hidden hover:border-lime/50 transition-colors">
                <div className="relative h-[140px] flex items-center justify-center overflow-hidden bg-bento-bg">
                  {isImage(m)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    : <FileText className={cn('w-10 h-10', isPdf(m) ? 'text-[#F87171]' : 'text-bento-muted')} />}
                  <span className="absolute top-2 right-2"><TypeBadge m={m} /></span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-bento-text truncate">{m.name}</p>
                  <p className="font-tech text-[10px] text-bento-muted mt-0.5">{fmtSize(m.size_bytes)} · {formatDate(m.created_at)}</p>
                </div>
                <div className={cn('absolute inset-0 bg-black/70 transition-opacity flex items-center justify-center gap-2 p-2',
                  confirmingId === m.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                  {confirmingId === m.id ? (
                    <div className="flex flex-col items-center gap-2 text-center px-2">
                      <p className="text-xs font-medium text-red-300">Excluir este material?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmingId(null)} disabled={deletingId === m.id} className="px-3 py-1.5 rounded-btn text-xs border border-white/30 text-white/80 hover:border-white transition-colors disabled:opacity-50">Cancelar</button>
                        <button onClick={() => handleDelete(m)} disabled={deletingId === m.id} className="px-3 py-1.5 rounded-btn text-xs font-semibold bg-red-500/90 hover:bg-red-500 text-white transition-colors disabled:opacity-50">{deletingId === m.id ? 'Excluindo...' : 'Excluir'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setPresenting(m)} className="bento-btn flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold min-h-0"><Search className="w-3.5 h-3.5" />Visualizar</button>
                      <button onClick={() => setConfirmingId(m.id)} aria-label="Excluir" className="bg-red-900/60 hover:bg-red-900 text-red-300 p-1.5 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Zona de upload */}
            {filter === 'todos' && !search && (
              <button onClick={() => inputRef.current?.click()} disabled={uploading}
                onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
                className={cn('h-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors text-bento-muted',
                  dragging ? 'border-lime bg-lime/10 text-lime-fg' : 'border-bento-border hover:border-lime hover:bg-lime/5 hover:text-lime-fg', 'disabled:opacity-50')}>
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">{uploading ? 'Enviando...' : 'Upload'}</span>
                <span className="font-tech text-[10px]">máx. 50 MB</span>
              </button>
            )}
          </div>

          {filteredMaterials.length === 0 && (search || filter !== 'todos') && (
            <p className="text-center text-sm text-bento-muted py-8">Nenhum material encontrado.</p>
          )}
        </div>
      ) : view === 'montar' ? (
        /* ═══ MONTAR ═══ */
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 sm:p-6">
          {/* Esquerda: materiais disponíveis */}
          <div className="lg:w-[340px] shrink-0 flex flex-col bento-fx overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-bento-border shrink-0">
              <span className="text-sm font-semibold text-bento-text">Materiais</span>
              <span className="font-tech text-xs text-bento-muted">{materials.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[120px]">
              {materials.length === 0 ? (
                <p className="text-xs text-bento-muted text-center py-6">Suba arquivos na aba Materiais primeiro.</p>
              ) : materials.map(m => {
                const added = selectedIds.includes(m.id)
                return (
                  <button key={m.id} onClick={() => addToSelection(m.id)} disabled={added}
                    className="group/it flex items-center gap-2 w-full text-left bg-bento-bg border border-bento-border rounded-md p-2 hover:border-lime/50 transition-colors disabled:opacity-50 disabled:hover:border-bento-border">
                    <Thumb m={m} className="w-9 h-9 rounded shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-bento-text truncate">{m.name}</p>
                      <p className="font-tech text-[10px] text-bento-muted">{fmtSize(m.size_bytes)}</p>
                    </div>
                    {added
                      ? <span className="font-tech text-[10px] text-lime-fg shrink-0">Adicionado</span>
                      : <Plus className="w-4 h-4 text-lime-fg shrink-0 opacity-0 group-hover/it:opacity-100 transition-opacity" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Direita: apresentação sendo montada */}
          <div className="flex-1 min-h-0 flex flex-col bento-fx overflow-hidden">
            <div className="p-3 border-b border-bento-border shrink-0 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={form.leadId} onChange={e => setForm(p => ({ ...p, leadId: e.target.value }))} className={cn(inputCls, 'sm:w-48')}>
                  <option value="">Cliente: nenhum</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Nome da apresentação" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-bento-text">Slides da Apresentação</span>
                <span className="font-tech text-xs text-bento-muted">{selectedIds.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 min-h-[120px]">
              {selectedIds.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <p className="text-xs text-bento-muted">Adicione materiais da lista à esquerda<br />para montar a apresentação.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSlideDragEnd}>
                  <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {selectedIds.map((id, i) => {
                        const m = matById.get(id)
                        if (!m) return null
                        return <SortableSlide key={id} id={id} index={i} total={selectedIds.length} m={m}
                          onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => removeFromSelection(id)} />
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 p-3 border-t border-bento-border shrink-0">
              <span className="font-tech text-xs text-bento-muted">{selectedIds.length} {selectedIds.length === 1 ? 'material' : 'materiais'}</span>
              <div className="flex gap-2">
                <button onClick={savePresentation} disabled={savingPres || !form.name.trim() || selectedIds.length === 0}
                  className="bento-btn flex items-center gap-1.5 px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50">
                  {savingPres ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ APRESENTAR ═══ */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2">
              <h3 className="font-display font-bold text-bento-text text-lg">Apresentações</h3>
              <span className="font-tech text-xs text-bento-muted">{presentations.length} salva{presentations.length === 1 ? '' : 's'}</span>
            </div>
            <button onClick={openNew} className="bento-btn flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold">
              <Plus className="w-4 h-4" />Nova apresentação
            </button>
          </div>

          {presError && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{presError}</div>}

          {presentations.length === 0 ? (
            <div className="bento-fx py-16 text-center">
              <Layers className="w-10 h-10 mx-auto mb-3 text-bento-muted/30" />
              <p className="text-sm text-bento-muted font-medium">Nenhuma apresentação montada ainda</p>
              <p className="text-xs text-bento-muted mt-1">Use a aba Montar para criar uma a partir dos seus materiais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {presentations.map(p => {
                const items = (p.items ?? []).map(id => matById.get(id)).filter(Boolean) as Material[]
                const lead = leadName(p.lead_id)
                return (
                  <div key={p.id} className="bento-fx p-4 flex flex-col gap-3 hover:border-lime/40 transition-colors">
                    <button onClick={() => startPresent(p)} className="text-left">
                      {lead && <p className="font-tech text-[10px] uppercase tracking-wider text-lime-fg truncate">{lead}</p>}
                      <p className="font-display font-bold text-bento-text truncate">{p.name}</p>
                      <div className="flex gap-1 mt-2">
                        {items.slice(0, 8).map(m => (
                          <div key={m.id} className="w-7 h-9 rounded-sm border border-bento-border overflow-hidden bg-bento-bg flex items-center justify-center shrink-0">
                            {isImage(m)
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={m.url} alt="" className="w-full h-full object-cover" />
                              : <FileText className={cn('w-3.5 h-3.5', isPdf(m) ? 'text-[#F87171]' : 'text-bento-muted')} />}
                          </div>
                        ))}
                        {items.length > 8 && <span className="font-tech text-[10px] text-bento-muted self-center ml-1">+{items.length - 8}</span>}
                        {items.length === 0 && <span className="font-tech text-[11px] text-bento-muted">sem materiais disponíveis</span>}
                      </div>
                    </button>

                    {confirmingPresId === p.id ? (
                      <div className="flex gap-2 mt-auto">
                        <button onClick={() => setConfirmingPresId(null)} disabled={deletingPresId === p.id} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-xs hover:border-bento-text transition-colors disabled:opacity-50">Cancelar</button>
                        <button onClick={() => deletePresentation(p)} disabled={deletingPresId === p.id} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-btn text-xs font-semibold transition-colors disabled:opacity-50">{deletingPresId === p.id ? 'Excluindo...' : 'Excluir'}</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                        <span className="font-tech text-[11px] text-bento-muted truncate">{items.length} {items.length === 1 ? 'material' : 'materiais'} · {formatDate(p.created_at)}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openPresentation(p)} aria-label="Editar" title="Editar" className="p-1.5 rounded-btn border border-bento-border text-bento-muted hover:border-lime hover:text-lime-fg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirmingPresId(p.id)} aria-label="Excluir" title="Excluir" className="p-1.5 rounded-btn border border-bento-border text-bento-muted hover:border-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => startPresent(p)} aria-label="Apresentar" title="Apresentar" className="w-8 h-8 rounded-full bg-lime hover:bg-lime-hover text-lime-ink flex items-center justify-center transition-colors"><Play className="w-4 h-4 fill-current" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Player de apresentação (single-mode, redesenhado) */}
      {playing && (
        <PresentationPlayer name={playing.name} client={playing.client} materials={playing.materials} onClose={() => setPlaying(null)} />
      )}

      {/* Pré-visualização de um material */}
      {presenting && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <button onClick={() => setPresenting(null)} title="Fechar (ESC)" className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-colors backdrop-blur-sm">
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-4 z-10">
            <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">{presenting.name}</p>
          </div>
          <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
            <MaterialFrame material={presenting} />
          </div>
        </div>
      )}
    </div>
  )
}
