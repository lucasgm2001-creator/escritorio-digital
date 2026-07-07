'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_MODULES, visibleNavModules } from '@/lib/navigation'
import { useModuleAccess } from '@/components/auth/ModuleAccessProvider'

// Launcher de MÓDULOS — só mobile (<1024px). O "Mais" da BottomNav abre ISTO (grid de andares), não mais o
// drawer lateral antigo (rail no celular era anti-padrão). FONTE ÚNICA de navegação (@/lib/navigation): mostra
// TODOS os módulos visíveis (respeita permissões via visibleNavModules); nada de 2ª lista. Cada tile = um andar.
export function ModuleLauncher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const ma = useModuleAccess()   // sem provider = mostra tudo (fail-open); com provider, "Sem acesso" some
  const modules = ma ? visibleNavModules(NAV_MODULES, ma.access, ma.canManageTeam) : NAV_MODULES
  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-[200]" role="dialog" aria-label="Módulos">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-frame bg-bento-bg border-t border-bento-border animate-slide-up pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-5 h-14 border-b border-bento-border shrink-0">
          <span className="font-display font-semibold text-sm text-bento-text">Módulos</span>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-panel transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-3 gap-2.5 overflow-y-auto">
          {modules.map(m => {
            const active = pathname === m.href || pathname.startsWith(m.href + '/')
            const Icon = m.Icon
            return (
              <Link
                key={m.href}
                href={m.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 aspect-square rounded-bento border p-3 text-center transition-colors [-webkit-tap-highlight-color:transparent]',
                  active ? 'border-lime/40 bg-lime/10 text-lime-fg' : 'border-bento-border bg-bento-panel text-bento-dim hover:border-lime/40 hover:text-bento-text active:scale-95',
                )}
              >
                <Icon className="w-6 h-6 shrink-0" />
                <span className="text-[11px] font-medium leading-tight">{m.shortLabel ?? m.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
