'use client'

import { useState } from 'react'
import { updateClientAction } from './client-write-actions'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { ChevronDown, ExternalLink, FolderOpen, Pencil, Plus } from 'lucide-react'
import type { Client } from './types'

// Dossiê do cliente (read-only do conteúdo): só GUARDA e ABRE links/notas do Drive — não sobe arquivo.
// Pasta raiz → coluna `drive_folder_url` (text). Seções → coluna `dossie` (jsonb), uma {url,notas} por
// seção, sempre com MERGE (preserva as outras). NÃO toca em dinheiro/plano/comissão.

const SECTIONS = [
  { key: 'planejamento', label: 'Planejamento Estratégico' },
  { key: 'briefing',     label: 'Briefing' },
  { key: 'materiais',    label: 'Materiais & Criativos' },
  { key: 'relatorios',   label: 'Relatórios' },
  { key: 'contrato',     label: 'Contrato' },
] as const
type SecKey = typeof SECTIONS[number]['key']

interface DossieSection { url: string; notas: string }
type Dossie = Record<SecKey, DossieSection>

// dossie vazio/null → objeto com as 5 seções tudo "".
function normalizeDossie(d: Client['dossie']): Dossie {
  const src = (d ?? {}) as Record<string, { url?: string; notas?: string } | undefined>
  return Object.fromEntries(
    SECTIONS.map(s => [s.key, { url: src[s.key]?.url ?? '', notas: src[s.key]?.notas ?? '' }]),
  ) as Dossie
}

// URL http/https válida (senão NÃO salva).
function isValidUrl(s: string): boolean {
  const v = s.trim()
  if (!v) return false
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
}

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime font-mono'
const saveBtn = 'bento-btn flex items-center justify-center gap-1.5 px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[40px]'
const ghostBtn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors min-h-[36px]'

export function DossieTab({ client, onSaved }: { client: Client; onSaved: (c: Client) => void }) {
  const { toast } = useToast()

  // Estado LOCAL (evita merge em cima de prop desatualizada dentro do modal).
  const [driveUrl, setDriveUrl] = useState(client.drive_folder_url ?? '')
  const [editingDrive, setEditingDrive] = useState(false)
  const [savingDrive, setSavingDrive] = useState(false)

  const [dossie, setDossie] = useState<Dossie>(() => normalizeDossie(client.dossie))
  const [open, setOpen] = useState<Set<SecKey>>(new Set())          // sanfonas FECHADAS por padrão
  const [editing, setEditing] = useState<Set<SecKey>>(new Set())    // seções em modo edição
  const [draft, setDraft] = useState<Dossie>(() => normalizeDossie(client.dossie))
  const [savingKey, setSavingKey] = useState<SecKey | null>(null)

  const toggle = (k: SecKey) => setOpen(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const startEdit = (k: SecKey) => {
    setDraft(p => ({ ...p, [k]: { ...dossie[k] } }))   // carrega o valor atual no rascunho
    setEditing(p => new Set(p).add(k))
  }
  const cancelEdit = (k: SecKey) =>
    setEditing(p => { const n = new Set(p); n.delete(k); return n })

  // ── Pasta raiz no Drive (coluna drive_folder_url) ──
  const saveDrive = async () => {
    const v = driveUrl.trim()
    if (v && !isValidUrl(v)) { toast({ type: 'error', message: 'Link inválido — use uma URL (http/https).' }); return }
    setSavingDrive(true)
    const res = await updateClientAction(client.id, { drive_folder_url: v || null })
    setSavingDrive(false)
    if (!res.ok) { toast({ type: 'error', message: `Não foi possível salvar: ${res.error}` }); return }
    setDriveUrl(v)
    setEditingDrive(false)
    onSaved({ ...client, drive_folder_url: v || null })
    if (v) toast({ type: 'success', message: 'Pasta salva.' })
  }

  // ── Seção do dossiê (coluna dossie, jsonb) — MERGE preservando as outras seções ──
  const saveSection = async (k: SecKey) => {
    const url = (draft[k]?.url ?? '').trim()
    const notas = (draft[k]?.notas ?? '').trim()
    if (url && !isValidUrl(url)) { toast({ type: 'error', message: 'Link inválido — use uma URL (http/https).' }); return }
    const merged: Dossie = { ...dossie, [k]: { url, notas } }
    setSavingKey(k)
    const res = await updateClientAction(client.id, { dossie: merged })
    setSavingKey(null)
    if (!res.ok) { toast({ type: 'error', message: `Não foi possível salvar: ${res.error}` }); return }
    setDossie(merged)
    cancelEdit(k)
    onSaved({ ...client, dossie: merged })
    toast({ type: 'success', message: 'Salvo.' })
  }

  const driveValid = isValidUrl(driveUrl)

  return (
    <div className="space-y-4">
      {/* FAIXA DO DRIVE — pasta raiz do cliente. */}
      <div className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-display font-semibold text-bento-text text-sm">
            <FolderOpen className="w-4 h-4 text-lime-fg" />Pasta no Google Drive
          </span>
          {driveValid && !editingDrive && (
            <div className="flex items-center gap-2">
              <a href={driveUrl.trim()} target="_blank" rel="noopener noreferrer"
                className="bento-btn flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold min-h-[36px]">
                <ExternalLink className="w-3.5 h-3.5" />Abrir pasta no Drive
              </a>
              <button type="button" onClick={() => setEditingDrive(true)} aria-label="Editar link da pasta"
                className="p-2 rounded-btn border border-bento-border text-bento-muted hover:border-lime hover:text-bento-text transition-colors min-h-[36px]">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {(editingDrive || !driveValid) && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={driveUrl} onChange={e => setDriveUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveDrive() }}
              placeholder="Colar link da pasta do Drive…" disabled={savingDrive} className={inputCls} />
            <button type="button" onClick={saveDrive} disabled={savingDrive} className={cn(saveBtn, 'sm:w-auto')}>
              {savingDrive ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* 5 SANFONAS — fechadas por padrão. */}
      <div className="space-y-2">
        {SECTIONS.map(s => {
          const cur = dossie[s.key]
          const hasContent = isValidUrl(cur.url) || !!cur.notas
          const isOpen = open.has(s.key)
          const isEditing = editing.has(s.key)
          const d = draft[s.key] ?? { url: '', notas: '' }
          return (
            <div key={s.key} className="bento-fx overflow-hidden">
              <button type="button" onClick={() => toggle(s.key)} aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left min-h-[48px]">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-none', hasContent ? 'bg-lime' : 'bg-bento-muted/50')} />
                  <span className="font-display font-semibold text-bento-text text-sm truncate">{s.label}</span>
                </span>
                <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-bento-border/60 space-y-2.5">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">Link no Drive</label>
                        <input value={d.url} onChange={e => setDraft(p => ({ ...p, [s.key]: { ...p[s.key], url: e.target.value } }))}
                          placeholder="Cole a URL do Drive…" disabled={savingKey === s.key} className={inputCls} />
                      </div>
                      <div>
                        <label className="block font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">Notas</label>
                        <textarea value={d.notas} onChange={e => setDraft(p => ({ ...p, [s.key]: { ...p[s.key], notas: e.target.value } }))}
                          rows={2} placeholder="Anotações desta seção…" disabled={savingKey === s.key}
                          className={cn(inputCls, 'font-sans resize-none')} />
                      </div>
                      <div className="flex gap-2 pt-0.5">
                        <button type="button" onClick={() => saveSection(s.key)} disabled={savingKey === s.key} className={saveBtn}>
                          {savingKey === s.key ? 'Salvando…' : 'Salvar'}
                        </button>
                        <button type="button" onClick={() => cancelEdit(s.key)} disabled={savingKey === s.key}
                          className="px-4 py-2 rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors min-h-[40px]">
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : hasContent ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        {isValidUrl(cur.url)
                          ? <a href={cur.url.trim()} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-fg hover:text-lime">
                              <ExternalLink className="w-3.5 h-3.5" />Abrir no Drive
                            </a>
                          : <span className="font-tech text-[11px] text-bento-muted">Sem link</span>}
                        <button type="button" onClick={() => startEdit(s.key)} className={ghostBtn}>
                          <Pencil className="w-3.5 h-3.5" />Editar
                        </button>
                      </div>
                      {cur.notas && <p className="text-sm text-bento-dim whitespace-pre-wrap leading-relaxed">{cur.notas}</p>}
                    </>
                  ) : (
                    <button type="button" onClick={() => startEdit(s.key)}
                      className="inline-flex items-center gap-1.5 font-tech text-[11px] text-bento-muted hover:text-lime-fg transition-colors">
                      <Plus className="w-3.5 h-3.5" />Adicionar link / nota
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
