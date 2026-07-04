'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronLeft, LayoutGrid, Briefcase, FolderOpen, Wallet, Users, UserPlus, ShieldCheck,
  Target, History, ScrollText, FileText, Star, CalendarDays, Mail,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { CompensationFlow } from '@/components/admin/CompensationFlow'
import type { CollaboratorDetailVM } from '@/lib/people/types'
import { cn } from '@/lib/utils'
import { COLLABORATOR_STATUS, MODULE_LEVEL_BADGE, TEAM_ROLE_BADGE, formatJoinedAt, initials } from '@/lib/people/presentation'
import { ROLE_CATALOG, ROLE_LEVEL_LABEL, COMP_MODEL_LABEL } from '@/lib/people/catalog'
import { InfoTile } from './InfoTile'

// Perfil profissional do colaborador (PEOPLE-001, Part 5) — estilo RH, em abas. Reusa header/InfoTile/Panel/
// EmptyState (DS). Enriquece com o catálogo de cargos (nível/remuneração padrão) quando o cargo casa por
// nome. Estados HONESTOS (Part 11): "Não configurado", "Nenhuma meta", etc. — nunca "em breve". Sem cálculo,
// sem persistência: mostra o que existe e o que ainda precisa de configuração.
type TabKey = 'resumo' | 'cargo' | 'equipes' | 'permissoes' | 'remuneracao' | 'metas' | 'historico' | 'auditoria' | 'documentos' | 'avaliacoes'
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'resumo', label: 'Resumo', icon: LayoutGrid },
  { key: 'cargo', label: 'Cargo', icon: Briefcase },
  { key: 'equipes', label: 'Equipes', icon: Users },
  { key: 'permissoes', label: 'Permissões', icon: ShieldCheck },
  { key: 'remuneracao', label: 'Remuneração', icon: Wallet },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'historico', label: 'Histórico', icon: History },
  { key: 'auditoria', label: 'Auditoria', icon: ScrollText },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'avaliacoes', label: 'Avaliações', icon: Star },
]

export function CollaboratorDetail({ collaborator, teamName }: { collaborator: CollaboratorDetailVM; teamName: string | null }) {
  const [tab, setTab] = useState<TabKey>('resumo')
  const status = COLLABORATOR_STATUS[collaborator.status]
  const role = TEAM_ROLE_BADGE[collaborator.teamRole]   // papel de acesso REAL (team_members)
  // Enriquecimento pelo catálogo profissional (best-effort por nome do cargo).
  const blueprint = ROLE_CATALOG.find(r => r.name === collaborator.roleName) ?? null

  return (
    <div className="space-y-6 md:space-y-7">
      <Link href="/admin/colaboradores" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px]">
        <ChevronLeft className="w-4 h-4" /> Colaboradores
      </Link>

      <header className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-xl text-lime-fg">
          {initials(collaborator.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text truncate">{collaborator.name}</h1>
            <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border', role.cls)}>{role.label}</span>
            <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border', status.cls)}>{status.label}</span>
          </div>
          {collaborator.email && <p className="text-[13px] text-bento-muted mt-1 truncate">{collaborator.email}</p>}
          {collaborator.joinedAt && <p className="text-[12px] text-bento-dim mt-0.5">Na equipe desde {formatJoinedAt(collaborator.joinedAt)}</p>}
        </div>
      </header>

      {/* Abas — rolam no mobile, sem apertar (Part 10). */}
      <div className="border-b border-bento-border -mx-1 px-1 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon
            const on = tab === t.key
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn('inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  on ? 'border-lime text-lime-fg' : 'border-transparent text-bento-dim hover:text-bento-text')}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-1">
        {tab === 'resumo' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <InfoTile icon={ShieldCheck} label="Papel de acesso" value={role.label} />
            <InfoTile icon={Briefcase} label="Cargo" value={collaborator.roleName ?? 'Não configurado'} />
            <InfoTile icon={FolderOpen} label="Departamento" value={collaborator.departmentName ?? 'Não configurado'} />
            <InfoTile icon={Wallet} label="Template" value={collaborator.templateName ?? 'Sem remuneração definida'} />
            <InfoTile icon={UserPlus} label="Gestor" value={collaborator.managerName ?? 'Não configurado'} />
            <InfoTile icon={Users} label="Equipe" value={teamName ?? '—'} />
            <InfoTile icon={CalendarDays} label="Entrada" value={formatJoinedAt(collaborator.joinedAt)} />
            <InfoTile icon={Mail} label="Email" value={collaborator.email ?? 'Não configurado'} />
          </div>
        )}

        {tab === 'cargo' && (
          <Panel label="Cargo & função">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-bento-text">{collaborator.roleName ?? 'Não configurado'}</p>
              <p className="text-[13px] text-bento-muted leading-relaxed">{collaborator.roleDescription ?? 'Sem descrição de cargo.'}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-[12px] pt-1">
                <div><dt className="text-bento-dim">Departamento</dt><dd className="text-bento-muted">{collaborator.departmentName ?? 'Não configurado'}</dd></div>
                <div><dt className="text-bento-dim">Nível</dt><dd className="text-bento-muted">{blueprint ? ROLE_LEVEL_LABEL[blueprint.level] : 'Não configurado'}</dd></div>
                <div><dt className="text-bento-dim">Remuneração padrão</dt><dd className="text-bento-muted">{blueprint ? COMP_MODEL_LABEL[blueprint.defaultComp] : 'Não configurado'}</dd></div>
              </dl>
            </div>
          </Panel>
        )}

        {tab === 'equipes' && (
          <Panel label="Equipes & acesso">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-[12px] text-bento-dim">Workspace ativo</dt><dd className="text-bento-text font-medium">{teamName ?? '—'}</dd></div>
              <div><dt className="text-[12px] text-bento-dim">Papel de acesso</dt><dd className="text-bento-text font-medium">{role.label}</dd></div>
              <div><dt className="text-[12px] text-bento-dim">Na equipe desde</dt><dd className="text-bento-text font-medium">{formatJoinedAt(collaborator.joinedAt)}</dd></div>
              <div><dt className="text-[12px] text-bento-dim">Email</dt><dd className="text-bento-text font-medium">{collaborator.email ?? 'Não configurado'}</dd></div>
            </dl>
          </Panel>
        )}

        {tab === 'permissoes' && (
          <div className="space-y-4">
            <Panel label="Acesso por módulo">
              <ul className="-my-1 divide-y divide-bento-border">
                {collaborator.moduleMatrix.map(mod => {
                  const lvl = MODULE_LEVEL_BADGE[mod.level]
                  return (
                    <li key={mod.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-bento-text">{mod.label}</span>
                      <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', lvl.cls)}>
                        {lvl.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <div className="rounded-frame border border-bento-border bg-bento-panel/40 p-4 space-y-1.5">
              <p className="text-[13px] text-bento-text font-medium">Como isto é calculado</p>
              <p className="text-[12px] text-bento-muted leading-relaxed">
                Níveis <strong className="text-bento-text">efetivos</strong> derivam do papel de acesso
                (<span className="text-bento-text">{role.label}</span>), resolvidos no servidor. Owner e administrador
                têm acesso total; membro começa com leitura em tudo.
              </p>
              <p className="text-[12px] text-bento-dim leading-relaxed">
                Personalizar por módulo (liberar acesso a um membro específico) é o próximo passo — grava e passa a
                valer no controle de acesso mediante autorização.
              </p>
            </div>
          </div>
        )}

        {tab === 'remuneracao' && (
          <Panel label="Remuneração">
            <div className="space-y-2">
              <p className="text-[13px] text-bento-text">Template: <span className="text-bento-muted">{collaborator.templateName ?? 'Sem remuneração definida'}</span></p>
              <p className="text-[13px] text-bento-text">Modelo padrão do cargo: <span className="text-bento-muted">{blueprint ? COMP_MODEL_LABEL[blueprint.defaultComp] : 'Requer configuração'}</span></p>
              <p className="text-[12px] text-bento-dim leading-relaxed">
                {collaborator.templateName ? 'Utilizando template padrão do cargo.' : 'Requer configuração.'} O cálculo usa a Compensation Engine; histórico não é recalculado.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-bento-border">
              <CompensationFlow />
            </div>
          </Panel>
        )}

        {tab === 'metas' && <EmptyState icon={Target} title="Nenhuma meta definida" description="Metas por colaborador serão configuradas aqui." />}
        {tab === 'historico' && <EmptyState icon={History} title="Sem histórico registrado" description="Mudanças de cargo, equipe e remuneração aparecerão aqui." />}
        {tab === 'auditoria' && <EmptyState icon={ScrollText} title="Sem eventos de auditoria" description="Quem fez o quê e quando — contratos employee.* já preparados (Event Bus)." />}
        {tab === 'documentos' && <EmptyState icon={FileText} title="Nenhum documento" description="Contratos e documentos do colaborador entrarão aqui." />}
        {tab === 'avaliacoes' && <EmptyState icon={Star} title="Nenhuma avaliação" description="Avaliações de desempenho entrarão aqui." />}
      </div>
    </div>
  )
}
