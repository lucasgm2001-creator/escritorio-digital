'use client'

import { useEffect, useState } from 'react'
import {
  Home, Briefcase, ListChecks, Projector, Users, Palette, Accessibility, Image as ImageIcon, User,
  LayoutGrid, Database, Plug, Info, Map, Boxes, ChevronLeft, ChevronDown, ShieldCheck, TrendingUp,
  Sparkles, Settings, type LucideIcon,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
// FasesTab arrasta @dnd-kit/* (grande) e só aparece na sub-tela "Fases do funil" (2 cliques) — carrega
// sob demanda (client-only) → sai do bundle inicial da rota SEM mudar a UI. Fallback discreto (DS-005).
function FasesTabLoading() { return <div className="py-16 text-center text-sm text-bento-muted">Carregando…</div> }
const FasesTab = dynamic(() => import('../comercial/tabs/FasesTab').then(m => ({ default: m.FasesTab })), { ssr: false, loading: FasesTabLoading })
import { HubClientesSettings } from '../clientes/HubClientesSettings'
import { TeamSettingsSection, type TeamSettingsInvite, type TeamSettingsMember } from './TeamSettingsSection'
import {
  ThemeSection, AccessibilitySection, AboutSection, ContaSection, AparenciaSection, DadosSection,
  IntegracoesSection, AndarSection, MapSettingsContent, LogoUploadSection, HallSettingsSection,
  SegurancaSection, TrafegoConfigSection, IaConfigSection, PlanosSection,
} from './ConfiguracoesSections'

interface NavItem { key: string; label: string; Icon: LucideIcon }

interface Props {
  userId: string
  google: { connected: boolean; email: string | null }
  teamSettings: {
    teamName: string | null
    members: TeamSettingsMember[]
    invites: TeamSettingsInvite[]
    canManage: boolean
    currentUserId: string
    currentRole: 'owner' | 'admin' | 'member'
    activeTeamId: string
    teams: { id: string; name: string; role: string }[]
  } | null
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Conta', items: [
    { key: 'conta', label: 'Conta e senha', Icon: User },
    { key: 'aparencia', label: 'Aparência', Icon: LayoutGrid },
    { key: 'tema', label: 'Tema', Icon: Palette },
    { key: 'acessibilidade', label: 'Acessibilidade', Icon: Accessibility },
    { key: 'andar-hall', label: 'Painel do Hall', Icon: Home },
  ] },
  { title: 'Equipe', items: [
    { key: 'equipe', label: 'Equipe e membros', Icon: Users },
  ] },
  { title: 'Segurança', items: [
    { key: 'seguranca', label: 'Segurança e permissões', Icon: ShieldCheck },
  ] },
  { title: 'Integrações', items: [
    { key: 'integracoes', label: 'Integrações', Icon: Plug },
  ] },
  { title: 'Comercial', items: [
    { key: 'andar-comercial', label: 'Funil e organização', Icon: Briefcase },
  ] },
  { title: 'Clientes', items: [
    { key: 'hub-clientes', label: 'Hub de Clientes', Icon: Boxes },
    { key: 'andar-clientes', label: 'Organização do andar', Icon: Users },
  ] },
  { title: 'Tráfego', items: [
    { key: 'trafego-config', label: 'Tráfego', Icon: TrendingUp },
  ] },
  { title: 'IA', items: [
    { key: 'ia-config', label: 'IA', Icon: Sparkles },
  ] },
  { title: 'Sistema', items: [
    { key: 'dados', label: 'Dados & Export', Icon: Database },
    { key: 'planos', label: 'Planos', Icon: LayoutGrid },
    { key: 'mapa', label: 'Mapa', Icon: Map },
    { key: 'andar-tarefas', label: 'Tarefas — organização', Icon: ListChecks },
    { key: 'andar-studio', label: 'Studio — organização', Icon: Projector },
    { key: 'logo', label: 'Logo do sistema', Icon: ImageIcon },
    { key: 'sobre', label: 'Sobre', Icon: Info },
  ] },
]

export function ConfiguracoesClient({ userId, google, teamSettings }: Props) {
  // Accordion: NENHUMA seção aberta ao carregar; clicar no cabeçalho expande/recolhe (uma por vez).
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [sub, setSub] = useState<string | null>(null)   // sub-tela (ex.: 'fases') dentro da seção aberta
  const toggle = (k: string) => { setSub(null); setOpenKey(cur => (cur === k ? null : k)) }

  // Tablet/Desktop (md+, ≥768px) = master-detail; celular = accordion. Default mobile p/ não dar hydration
  // mismatch; ajusta no mount (mesmo padrão do DashboardShell). Sem query nova — só layout.
  const [isWide, setIsWide] = useState(false)
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Conteúdo de cada seção (renderizado só quando aberta).
  const renderContent = (key: string) => {
    if (sub === 'fases') return <FasesTab />
    if (key === 'andar-hall') return <HallSettingsSection userId={userId} />
    if (key.startsWith('andar-')) {
      const label = GROUPS.flatMap(g => g.items).find(a => a.key === key)?.label ?? 'Andar'
      return <AndarSection keyId={key} label={label} onOpenSub={setSub} />
    }
    switch (key) {
      case 'equipe': return teamSettings ? <TeamSettingsSection {...teamSettings} /> : null
      case 'seguranca': return <SegurancaSection role={teamSettings?.currentRole ?? 'member'} />
      case 'trafego-config': return <TrafegoConfigSection />
      case 'ia-config': return <IaConfigSection />
      case 'tema': return <ThemeSection />
      case 'mapa': return <MapSettingsContent />
      case 'hub-clientes': return <HubClientesSettings />
      case 'acessibilidade': return <AccessibilitySection />
      case 'logo': return <Panel label="Logo do sistema"><LogoUploadSection userId={userId} /></Panel>
      case 'sobre': return <AboutSection />
      case 'conta': return <ContaSection />
      case 'aparencia': return <AparenciaSection />
      case 'dados': return <DadosSection />
      case 'integracoes': return <IntegracoesSection google={google} />
      case 'planos': return <PlanosSection />
      default: return null
    }
  }

  return (
    <div className={cn('p-4 sm:p-6 mx-auto font-body', isWide ? 'max-w-6xl' : 'max-w-3xl')}>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Configurações</h1>
        <p className="text-bento-muted text-sm mt-0.5">{isWide ? 'Escolha uma seção à esquerda' : 'Toque numa seção para abrir'}</p>
      </div>

      {isWide ? (
        /* ── Tablet/Desktop: MASTER-DETAIL (não accordion). Esquerda = domínios; direita = conteúdo. ── */
        <div className="flex gap-6 items-start">
          <nav className="w-60 shrink-0 space-y-4">
            {GROUPS.map(g => (
              <div key={g.title}>
                <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5 px-1">{g.title}</p>
                <div className="space-y-0.5">
                  {g.items.filter(it => it.key !== 'equipe' || teamSettings).map(it => {
                    const active = openKey === it.key
                    return (
                      <button key={it.key} type="button" onClick={() => { setSub(null); setOpenKey(it.key) }}
                        className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm min-h-[40px] transition-colors',
                          active ? 'bg-lime/15 text-lime-fg font-medium' : 'text-bento-muted hover:bg-bento-bg/60 hover:text-bento-text')}>
                        <it.Icon className={cn('w-4 h-4 shrink-0', active ? 'text-lime-fg' : 'text-bento-muted')} />
                        <span className="truncate">{it.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="flex-1 min-w-0">
            {openKey ? (
              <>
                {sub && (
                  <button type="button" onClick={() => setSub(null)}
                    className="flex items-center gap-1 -ml-1 mb-4 text-sm font-medium text-bento-dim hover:text-bento-text min-h-[44px]">
                    <ChevronLeft className="w-4 h-4" />Voltar
                  </button>
                )}
                {renderContent(openKey)}
              </>
            ) : (
              <EmptyState icon={Settings} title="Selecione uma seção" description="Escolha um item à esquerda para configurar o Escritório Digital." />
            )}
          </div>
        </div>
      ) : (
      <div className="space-y-5">
        {GROUPS.map(g => (
          <div key={g.title}>
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5 px-1">{g.title}</p>
            <div className="space-y-2">
              {g.items.filter(it => it.key !== 'equipe' || teamSettings).map(it => {
                const open = openKey === it.key
                return (
                  <div key={it.key} className="bento-fx p-0 overflow-hidden">
                    <button type="button" onClick={() => toggle(it.key)} aria-expanded={open}
                      className="w-full flex items-center gap-3 px-4 min-h-[52px] text-left hover:bg-bento-bg/50 transition-colors">
                      <it.Icon className={cn('w-4 h-4 flex-none', open ? 'text-lime-fg' : 'text-bento-muted')} />
                      <span className="text-sm text-bento-text flex-1 min-w-0 truncate">{it.label}</span>
                      <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-1 border-t border-bento-border/60">
                        {/* "‹ Voltar" da sub-tela (Fases) → volta pro conteúdo da seção. */}
                        {sub && (
                          <button type="button" onClick={() => setSub(null)}
                            className="flex items-center gap-1 -ml-1 mb-4 text-sm font-medium text-bento-dim hover:text-bento-text min-h-[44px]">
                            <ChevronLeft className="w-4 h-4" />Voltar
                          </button>
                        )}
                        {renderContent(it.key)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
