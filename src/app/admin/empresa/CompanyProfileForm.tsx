'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Building2, Globe2, HeartHandshake, LockKeyhole, MapPin, Save, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { updateCompanyProfileAction, type CompanyProfileInput } from './actions'

const inputClass = 'w-full min-w-0 rounded-xl border border-bento-border bg-bento-bg/70 px-3.5 py-2.5 text-sm text-bento-text outline-none transition placeholder:text-bento-dim focus:border-lime/60 focus:ring-2 focus:ring-lime/10 disabled:cursor-not-allowed disabled:opacity-60'
const labelClass = 'mb-1.5 block text-xs font-medium text-bento-muted'

function Field({ label, value, onChange, disabled, type = 'text', placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; type?: string; placeholder?: string; maxLength?: number }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} maxLength={maxLength} className={inputClass} /></label>
}
function TextArea({ label, value, onChange, disabled, placeholder, maxLength, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; placeholder?: string; maxLength?: number; rows?: number }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span><textarea value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} maxLength={maxLength} rows={rows} className={`${inputClass} resize-y`} /></label>
}
function Select({ label, value, onChange, disabled, options }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; options: { value: string; label: string }[] }) {
  return <label className="block min-w-0"><span className={labelClass}>{label}</span><select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={inputClass}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}
function Section({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-bento border border-bento-border bg-bento-surface/40"><div className="flex items-start gap-3 border-b border-bento-border px-4 py-4 sm:px-6"><div className="rounded-xl border border-lime/20 bg-lime/10 p-2 text-lime-fg"><Icon className="h-4 w-4" /></div><div className="min-w-0"><h2 className="font-display text-base font-semibold text-bento-text">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-bento-muted">{description}</p></div></div><div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2">{children}</div></section>
}

export function CompanyProfileForm({ initial, canEdit }: { initial: CompanyProfileInput; canEdit: boolean }) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()
  const disabled = !canEdit || isPending
  const set = (key: keyof CompanyProfileInput, value: string) => setForm(current => ({ ...current, [key]: value }))

  function save() {
    startTransition(async () => {
      const result = await updateCompanyProfileAction(form)
      if (!result.ok) { toast({ type: 'error', message: result.error }); return }
      toast({ type: 'success', message: 'Dados da empresa atualizados.' }); router.refresh()
    })
  }

  return <div className="space-y-5">
    {!canEdit && <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p>Você pode consultar estes dados. Por segurança, somente o owner da empresa pode alterá-los.</p></div>}

    <Section icon={Building2} title="Identidade da empresa" description="Nome do workspace, cadastro e apresentação institucional.">
      <Field label="Nome da empresa / workspace *" value={form.name} onChange={v => set('name', v)} disabled={disabled} maxLength={120} />
      <Field label="Razão social" value={form.legalName} onChange={v => set('legalName', v)} disabled={disabled} maxLength={180} />
      <Field label="CNPJ / documento fiscal" value={form.taxId} onChange={v => set('taxId', v)} disabled={disabled} maxLength={40} />
      <Field label="Segmento de atuação" value={form.industry} onChange={v => set('industry', v)} disabled={disabled} maxLength={100} />
      <div className="md:col-span-2"><TextArea label="Sobre a empresa" value={form.description} onChange={v => set('description', v)} disabled={disabled} maxLength={1200} placeholder="Uma apresentação objetiva da empresa, seus serviços e diferenciais." /></div>
      <div className="md:col-span-2"><TextArea label="Lema da empresa" value={form.motto} onChange={v => set('motto', v)} disabled={disabled} maxLength={240} rows={2} placeholder="A frase que representa a empresa." /></div>
    </Section>

    <Section icon={HeartHandshake} title="Cultura" description="Missão, visão e valores fazem parte do cadastro padrão de toda empresa.">
      <TextArea label="Missão" value={form.mission} onChange={v => set('mission', v)} disabled={disabled} maxLength={800} placeholder="Por que a empresa existe?" />
      <TextArea label="Visão" value={form.vision} onChange={v => set('vision', v)} disabled={disabled} maxLength={800} placeholder="Onde a empresa quer chegar?" />
      <div className="md:col-span-2"><TextArea label="Valores da empresa — um por linha" value={form.values.join('\n')} onChange={v => setForm(current => ({ ...current, values: v.split('\n') }))} disabled={disabled} rows={6} placeholder={'Integridade\nExcelência\nFoco no cliente'} /><p className="mt-1.5 text-[11px] text-bento-dim">Até 20 valores. Eles serão salvos como itens separados.</p></div>
    </Section>

    <Section icon={Globe2} title="Contato e preferências" description="Informações públicas e padrões usados pelo workspace.">
      <Field label="Site" type="url" value={form.website} onChange={v => set('website', v)} disabled={disabled} maxLength={300} placeholder="https://suaempresa.com" />
      <Field label="E-mail da empresa" type="email" value={form.contactEmail} onChange={v => set('contactEmail', v)} disabled={disabled} maxLength={254} />
      <Field label="Telefone" value={form.contactPhone} onChange={v => set('contactPhone', v)} disabled={disabled} maxLength={40} />
      <Select label="Fuso horário" value={form.timezone} onChange={v => set('timezone', v)} disabled={disabled} options={[{ value: 'America/Sao_Paulo', label: 'Brasília' }, { value: 'America/New_York', label: 'EUA — Leste' }, { value: 'America/Chicago', label: 'EUA — Central' }, { value: 'America/Denver', label: 'EUA — Montanha' }, { value: 'America/Los_Angeles', label: 'EUA — Oeste' }]} />
      <Select label="Moeda padrão" value={form.currency} onChange={v => set('currency', v)} disabled={disabled} options={[{ value: 'USD', label: 'USD — Dólar americano' }, { value: 'BRL', label: 'BRL — Real brasileiro' }, { value: 'EUR', label: 'EUR — Euro' }]} />
      <Select label="Idioma / localidade" value={form.locale} onChange={v => set('locale', v)} disabled={disabled} options={[{ value: 'pt-BR', label: 'Português (Brasil)' }, { value: 'en-US', label: 'English (United States)' }, { value: 'es-ES', label: 'Español' }]} />
    </Section>

    <Section icon={MapPin} title="Endereço" description="Localização cadastral da empresa.">
      <div className="md:col-span-2"><Field label="Endereço" value={form.addressLine} onChange={v => set('addressLine', v)} disabled={disabled} maxLength={240} /></div>
      <Field label="Cidade" value={form.city} onChange={v => set('city', v)} disabled={disabled} maxLength={100} />
      <Field label="Estado / região" value={form.state} onChange={v => set('state', v)} disabled={disabled} maxLength={100} />
      <Field label="CEP / código postal" value={form.postalCode} onChange={v => set('postalCode', v)} disabled={disabled} maxLength={24} />
      <Field label="País" value={form.country} onChange={v => set('country', v)} disabled={disabled} maxLength={100} />
    </Section>

    {canEdit && <div className="sticky bottom-4 z-10 flex justify-end"><button type="button" onClick={save} disabled={isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Save className="h-4 w-4" />{isPending ? 'Salvando…' : 'Salvar alterações'}</button></div>}
  </div>
}
