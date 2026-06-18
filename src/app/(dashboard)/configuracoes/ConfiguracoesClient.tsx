'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Sun, Moon, Monitor, Home, Briefcase, ListChecks, Projector, Users,
  Palette, Accessibility, Image as ImageIcon, User, LayoutGrid, Database, Plug, Info,
  type LucideIcon,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SYSTEM_LOGO_BUCKET, SYSTEM_LOGO_PATH } from '@/lib/logo'
import { isDarkByTime, getDarkHours, DEFAULT_DARK_START, DEFAULT_DARK_END } from '@/lib/theme'
import { loadA11y, saveA11y, applyA11y, DEFAULT_A11Y, type A11ySettings, type FontScale } from '@/lib/a11y'

type Theme = 'light' | 'dark' | 'auto'
interface NavItem { key: string; label: string; Icon: LucideIcon }

// ─── SISTEMA › Tema (claro/escuro/auto + horários da virada, client/localStorage) ───
function ThemeSection() {
  const [theme, setTheme] = useState<Theme>('auto')
  const [start, setStart] = useState(DEFAULT_DARK_START)
  const [end, setEnd] = useState(DEFAULT_DARK_END)
  const [mounted, setMounted] = useState(false)

  const apply = useCallback((t: Theme) => {
    const html = document.documentElement
    const dark = t === 'dark' || (t === 'auto' && isDarkByTime())
    if (dark) { html.style.colorScheme = 'dark'; html.classList.add('dark'); html.classList.remove('light') }
    else { html.style.colorScheme = 'light'; html.classList.add('light'); html.classList.remove('dark') }
  }, [])

  useEffect(() => {
    setMounted(true)
    try { const t = localStorage.getItem('theme') as Theme | null; if (t) setTheme(t) } catch { /* ignore */ }
    const h = getDarkHours(); setStart(h.start); setEnd(h.end)
  }, [])

  const choose = (t: Theme) => {
    setTheme(t)
    try { localStorage.setItem('theme', t) } catch { /* ignore */ }
    apply(t)
  }
  const saveHours = (ns: number, ne: number) => {
    setStart(ns); setEnd(ne)
    try { localStorage.setItem('theme_dark_start', String(ns)); localStorage.setItem('theme_dark_end', String(ne)) } catch { /* ignore */ }
    apply(theme)
  }
  if (!mounted) return null

  const opts: { id: Theme; label: string; Icon: LucideIcon }[] = [
    { id: 'light', label: 'Claro', Icon: Sun }, { id: 'dark', label: 'Escuro', Icon: Moon }, { id: 'auto', label: 'Auto', Icon: Monitor },
  ]
  const hourOpts = Array.from({ length: 24 }, (_, i) => i)
  const selCls = 'mt-1 block bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-sm text-bento-text focus:outline-none focus:border-lime'

  return (
    <Panel label="Tema">
      <div className="space-y-4">
        <div className="flex gap-2">
          {opts.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => choose(id)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-btn border text-sm min-h-[44px]',
                theme === id ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} /><span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
        {theme === 'auto' && (
          <div className="border-t border-bento-border/60 pt-4">
            <p className="text-sm font-medium text-bento-text">Virada automática</p>
            <p className="text-xs text-bento-muted mt-0.5 mb-3">
              Escuro das <span className="font-tech text-bento-text">{String(start).padStart(2, '0')}h</span> às <span className="font-tech text-bento-text">{String(end).padStart(2, '0')}h</span>.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="text-xs text-bento-muted">Início (vira escuro)
                <select value={start} onChange={e => saveHours(Number(e.target.value), end)} className={selCls}>
                  {hourOpts.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
                </select>
              </label>
              <label className="text-xs text-bento-muted">Fim (vira claro)
                <select value={end} onChange={e => saveHours(start, Number(e.target.value))} className={selCls}>
                  {hourOpts.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Acessibilidade (client/localStorage, classes no <html>) ───
function ToggleRow({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-bento-text">{label}</p>
        <p className="text-xs text-bento-muted mt-0.5">{desc}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} onClick={onClick}
        className={cn('px-3 py-1.5 rounded-btn text-xs font-semibold border min-h-[36px] flex-none',
          on ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
        {on ? 'Ativado' : 'Desativado'}
      </button>
    </div>
  )
}

function AccessibilitySection() {
  const [s, setS] = useState<A11ySettings>(DEFAULT_A11Y)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); const v = loadA11y(); setS(v); applyA11y(v) }, [])
  const update = (patch: Partial<A11ySettings>) => { const next = { ...s, ...patch }; setS(next); saveA11y(next); applyA11y(next) }
  if (!mounted) return null

  const fonts: { id: FontScale; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'grande', label: 'Grande' }, { id: 'maior', label: 'Maior' }]
  return (
    <Panel label="Acessibilidade">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-bento-text mb-2">Tamanho da fonte</p>
          <div className="flex gap-2">
            {fonts.map(f => (
              <button key={f.id} onClick={() => update({ font: f.id })}
                className={cn('px-3 py-2 rounded-btn border text-sm min-h-[44px]',
                  s.font === f.id ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-bento-border/60 border-t border-bento-border/60 pt-1">
          <ToggleRow label="Alto contraste" desc="Aumenta o contraste de textos e bordas." on={s.contrast} onClick={() => update({ contrast: !s.contrast })} />
          <ToggleRow label="Mais espaçamento" desc="Aumenta o respiro entre as linhas." on={s.spacing} onClick={() => update({ spacing: !s.spacing })} />
          <ToggleRow label="Reduzir movimento" desc="Desliga animações e transições." on={s.reduceMotion} onClick={() => update({ reduceMotion: !s.reduceMotion })} />
        </div>
      </div>
    </Panel>
  )
}

function AboutSection() {
  return (
    <Panel label="Sobre">
      <div className="space-y-1">
        <p className="text-sm font-medium text-bento-text">Escritório Digital v2</p>
        <p className="font-tech text-xs text-bento-muted">DR Growth · {new Date().getFullYear()}</p>
        <p className="font-tech text-xs text-bento-muted">Idioma: Português (Brasil)</p>
      </div>
    </Panel>
  )
}

function Placeholder({ label, desc }: { label: string; desc: string }) {
  return (
    <Panel label={label}>
      <div className="py-8 text-center">
        <p className="text-sm text-bento-muted">{desc}</p>
        <p className="font-tech text-[11px] text-bento-muted/60 mt-1">Em breve</p>
      </div>
    </Panel>
  )
}

// ─── Logo Upload (preservado) ───────────────────────────────────────────────────
async function resizeLogo(file: File, maxKb = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const MAX_DIM = 512
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio); height = Math.round(height * ratio)
      }
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const tryQ = (q: number) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Falha ao converter')); return }
          if (blob.size > maxKb * 1024 && q > 0.3) tryQ(q - 0.1)
          else resolve(blob)
        }, 'image/jpeg', q)
      }
      tryQ(0.9)
    }
    img.onerror = reject
    img.src = url
  })
}

function LogoUploadSection({ userId }: { userId: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('logo_url').eq('id', userId).single().then(({ data }) => {
      if (data?.logo_url) setLogoUrl(data.logo_url)
    })
  }, [userId])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem.'); return }
    setUploading(true); setError(''); setSuccess('')
    try {
      const blob = await resizeLogo(file, 200)
      const supabase = createClient()
      const { error: upErr } = await supabase.storage.from(SYSTEM_LOGO_BUCKET).upload(SYSTEM_LOGO_PATH, blob, {
        contentType: 'image/jpeg', cacheControl: '60', upsert: true,
      })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from(SYSTEM_LOGO_BUCKET).getPublicUrl(SYSTEM_LOGO_PATH)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ logo_url: urlWithBust }).eq('id', userId)
      setLogoUrl(urlWithBust)
      setSuccess('Logo atualizada. Recarregue a página para vê-la no menu lateral.')
    } catch (err) {
      console.error(err)
      setError('Erro ao enviar logo. Verifique o bucket "assets" no Supabase.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-bento-muted">Substitua a logo padrão do sistema. Máximo 200kb, qualquer formato de imagem.</p>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-bento-border flex items-center justify-center bg-bento-bg overflow-hidden shrink-0">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo" width={64} height={64} className="w-full h-full object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-lime flex items-center justify-center">
              <svg className="w-4 h-4 text-lime-ink" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
        </div>
        <div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 bg-bento-bg border border-bento-border text-bento-text px-4 py-2 rounded-btn text-sm hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Enviando...' : 'Alterar logo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">{success}</p>}
    </div>
  )
}

// ─── Navegação ────────────────────────────────────────────────────────────────
const ANDARES: NavItem[] = [
  { key: 'andar-hall', label: 'Hall', Icon: Home },
  { key: 'andar-comercial', label: 'Comercial', Icon: Briefcase },
  { key: 'andar-tarefas', label: 'Tarefas', Icon: ListChecks },
  { key: 'andar-studio', label: 'Studio', Icon: Projector },
  { key: 'andar-clientes', label: 'Clientes', Icon: Users },
]
const SISTEMA: NavItem[] = [
  { key: 'tema', label: 'Tema', Icon: Palette },
  { key: 'acessibilidade', label: 'Acessibilidade', Icon: Accessibility },
  { key: 'logo', label: 'Logo do sistema', Icon: ImageIcon },
  { key: 'conta', label: 'Conta', Icon: User },
  { key: 'aparencia', label: 'Aparência', Icon: LayoutGrid },
  { key: 'dados', label: 'Dados & Export', Icon: Database },
  { key: 'integracoes', label: 'Integrações', Icon: Plug },
  { key: 'sobre', label: 'Sobre', Icon: Info },
]

function NavGroup({ title, items, active, onSelect }: { title: string; items: NavItem[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div>
      <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted px-2 mb-1.5">{title}</p>
      <div className="space-y-0.5">
        {items.map(it => (
          <button key={it.key} onClick={() => onSelect(it.key)}
            className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-btn text-sm text-left transition-colors',
              active === it.key ? 'bg-lime/15 text-lime-fg font-semibold' : 'text-bento-dim hover:text-bento-text hover:bg-bento-bg')}>
            <it.Icon className="w-4 h-4 flex-none" />{it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────
interface Props { userId: string }

export function ConfiguracoesClient({ userId }: Props) {
  const [active, setActive] = useState('tema')

  const content = (() => {
    if (active.startsWith('andar-')) {
      const label = ANDARES.find(a => a.key === active)?.label ?? 'Andar'
      return <Placeholder label={`Andar — ${label}`} desc={`Ajustes do andar ${label}.`} />
    }
    switch (active) {
      case 'tema': return <ThemeSection />
      case 'acessibilidade': return <AccessibilitySection />
      case 'logo': return <Panel label="Logo do sistema"><LogoUploadSection userId={userId} /></Panel>
      case 'sobre': return <AboutSection />
      case 'conta': return <Placeholder label="Conta" desc="Perfil, e-mail e senha." />
      case 'aparencia': return <Placeholder label="Aparência" desc="Densidade e layout." />
      case 'dados': return <Placeholder label="Dados & Export" desc="Exportar e baixar seus dados." />
      case 'integracoes': return <Placeholder label="Integrações" desc="Supabase, Anthropic, WhatsApp." />
      default: return null
    }
  })()

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto font-body">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Configurações</h1>
        <p className="text-bento-muted text-sm mt-0.5">Andares e Sistema</p>
      </div>
      <div className="flex flex-col md:flex-row gap-5">
        <nav className="md:w-56 shrink-0 space-y-4">
          <NavGroup title="Andares" items={ANDARES} active={active} onSelect={setActive} />
          <NavGroup title="Sistema" items={SISTEMA} active={active} onSelect={setActive} />
        </nav>
        <div className="flex-1 min-w-0">{content}</div>
      </div>
    </div>
  )
}
