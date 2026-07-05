'use client'

import { useState } from 'react'
import { User, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PerfilClient } from './PerfilClient'
import { MinhaRemuneracao } from './MinhaRemuneracao'
import type { MyCompensationView } from '@/server/services/MyCompensationService'

// Casca do Perfil (COMPENSATION-REAL-001, Parte 2): duas abas — "Meu perfil" (o form existente, intacto) e
// "Minha Remuneração" (visão do colaborador, só leitura, vinda pronta do servidor). Nunca usa Administração.
type ProfileProps = {
  userId: string; email: string; initialName: string; initialPhone: string; cargos: { key: string; name: string }[]; initialAvatarUrl: string | null
}
const TABS: { key: 'perfil' | 'remuneracao'; label: string; icon: LucideIcon }[] = [
  { key: 'perfil', label: 'Meu perfil', icon: User },
  { key: 'remuneracao', label: 'Minha Remuneração', icon: Wallet },
]

export function PerfilShell({ profile, comp, workspace }: { profile: ProfileProps; comp: MyCompensationView; workspace: string }) {
  const [tab, setTab] = useState<'perfil' | 'remuneracao'>('perfil')
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 border-b border-bento-border min-w-max">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn('inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap min-h-[40px]',
                tab === t.key ? 'border-bento-text text-bento-text' : 'border-transparent text-bento-muted hover:text-bento-text')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'perfil' ? <PerfilClient {...profile} /> : <MinhaRemuneracao vm={comp} workspace={workspace} />}
    </div>
  )
}
