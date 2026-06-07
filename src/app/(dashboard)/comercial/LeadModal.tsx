'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from './types'

interface Seller { id: string; name: string }

interface Props {
  onClose: () => void
  onCreated: (lead: Lead) => void
  currentUser: { id: string; name: string }
}

const EMPTY_FORM = {
  name: '', company: '', email: '', phone: '',
  value: '', operation: 'brasil', notes: '',
  nicho: '', origem: '', prioridade: 'media',
  next_contact: '', assigned_to: '', assigned_name: '',
}

const ORIGENS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google Ads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'site',      label: 'Site' },
  { value: 'outro',     label: 'Outro' },
]

const PRIORIDADES = [
  { value: 'baixa',   label: 'Baixa',   color: 'text-slate-600  bg-slate-50  border-slate-200' },
  { value: 'media',   label: 'Média',   color: 'text-blue-600   bg-blue-50   border-blue-200' },
  { value: 'alta',    label: 'Alta',    color: 'text-amber-600  bg-amber-50  border-amber-200' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-600    bg-red-50    border-red-200' },
]

export function LeadModal({ onClose, onCreated, currentUser }: Props) {
  const [form, setForm] = useState({ ...EMPTY_FORM, assigned_to: currentUser.id, assigned_name: currentUser.name })
  const [loading, setLoading] = useState(false)
  const [aiPaste, setAiPaste] = useState(false)
  const [rawText, setRawText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sellers, setSellers] = useState<Seller[]>([])

  const supabase = createClient()

  useEffect(() => {
    supabase.from('sellers').select('id, name').eq('status', 'ativo').order('name').then(({ data }) => {
      setSellers(data ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleAiParse = async () => {
    if (!rawText.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/parse-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (data.lead) {
        setForm(prev => ({ ...prev, ...data.lead }))
        setAiPaste(false)
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const { data, error } = await supabase.from('leads').insert({
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      value: parseFloat(form.value) || 0,
      operation: form.operation,
      notes: form.notes || null,
      nicho: form.nicho || null,
      origem: form.origem || null,
      prioridade: form.prioridade,
      next_contact: form.next_contact || null,
      assigned_to: form.assigned_to || currentUser.id,
      assigned_name: form.assigned_name || currentUser.name,
      score: 500,
      status: 'novo',
    }).select().single()

    if (!error && data) {
      await supabase.from('activities').insert({
        type: 'lead',
        description: `Novo lead cadastrado: ${form.name}`,
        user_name: currentUser.name,
        entity_id: data.id,
      })
      onCreated(data as Lead)
      onClose()
    }
    setLoading(false)
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      {children}
    </div>
  )

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 bg-white'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="font-bold text-foreground text-base">Novo Lead</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiPaste(!aiPaste)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                aiPaste
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Preencher com IA
              </span>
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* AI paste area */}
        {aiPaste && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 shrink-0">
            <p className="text-xs text-indigo-700 mb-2 font-medium">Cole o texto do WhatsApp, formulário ou qualquer texto com os dados do lead:</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full border border-indigo-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-400 bg-white"
              rows={3}
              placeholder="Nome: João Silva&#10;Empresa: ABC Ltda&#10;Telefone: (11) 99999-9999&#10;Nicho: E-commerce"
            />
            <button
              onClick={handleAiParse}
              disabled={aiLoading || !rawText.trim()}
              className="mt-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {aiLoading ? 'Analisando...' : 'Extrair dados'}
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Linha 1: Nome + Empresa */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                className={inputCls} placeholder="Nome completo" />
            </Field>
            <Field label="Empresa">
              <input value={form.company} onChange={e => set('company', e.target.value)}
                className={inputCls} placeholder="Nome da empresa" />
            </Field>
          </div>

          {/* Linha 2: Telefone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className={inputCls} placeholder="+55 (11) 99999-9999" />
            </Field>
            <Field label="E-mail">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inputCls} placeholder="email@exemplo.com" />
            </Field>
          </div>

          {/* Linha 3: Nicho + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nicho / Segmento">
              <input value={form.nicho} onChange={e => set('nicho', e.target.value)}
                className={inputCls} placeholder="Ex: E-commerce, Clínica, SaaS..." />
            </Field>
            <Field label="Valor estimado (R$)">
              <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                className={inputCls} placeholder="0" min="0" />
            </Field>
          </div>

          {/* Linha 4: Origem + Próximo contato */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <select value={form.origem} onChange={e => set('origem', e.target.value)} className={inputCls}>
                <option value="">— Selecionar —</option>
                {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Próximo contato">
              <input type="date" value={form.next_contact} onChange={e => set('next_contact', e.target.value)}
                className={inputCls} />
            </Field>
          </div>

          {/* Linha 5: Prioridade */}
          <Field label="Prioridade">
            <div className="flex gap-2">
              {PRIORIDADES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('prioridade', p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.prioridade === p.value ? p.color : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Linha 6: Operação */}
          <Field label="Operação">
            <div className="flex gap-2">
              {(['brasil', 'eua'] as const).map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => set('operation', op)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.operation === op
                      ? 'bg-primary-900 text-white border-primary-900'
                      : 'border-border text-muted-foreground hover:border-primary-300'
                  }`}
                >
                  {op === 'brasil' ? 'Brasil' : 'EUA'}
                </button>
              ))}
            </div>
          </Field>

          {/* Linha 7: Responsável */}
          <Field label="Responsável">
            <select
              value={form.assigned_to}
              onChange={e => {
                const sel = sellers.find(s => s.id === e.target.value)
                setForm(prev => ({
                  ...prev,
                  assigned_to: e.target.value || currentUser.id,
                  assigned_name: sel?.name || currentUser.name,
                }))
              }}
              className={inputCls}
            >
              <option value={currentUser.id}>{currentUser.name} (eu)</option>
              {sellers.filter(s => s.id !== currentUser.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>

          {/* Observações */}
          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Contexto, dores, próximos passos..."
            />
          </Field>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
