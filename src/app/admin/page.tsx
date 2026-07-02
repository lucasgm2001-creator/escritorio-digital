import Link from 'next/link'
import { ADMIN_GROUPS, ADMIN_SECTIONS } from '@/lib/admin/sections'

// Painel administrativo (overview). No celular é o "master" (lista); no iPad/Desktop é a landing.
export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Administração</p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Painel administrativo</h1>
        <p className="text-sm text-bento-muted max-w-prose">
          A sala de máquinas do seu workspace: pessoas, regras, plataforma e observabilidade. Cada área nasce da
          Constituição do Escritório Digital.
        </p>
      </header>

      {ADMIN_GROUPS.map(group => {
        const items = ADMIN_SECTIONS.filter(section => section.group === group.key)
        if (items.length === 0) return null
        return (
          <section key={group.key} className="space-y-3">
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{group.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map(section => {
                const Icon = section.icon
                return (
                  <Link
                    key={section.key}
                    href={section.href}
                    className="bento-fx p-4 flex flex-col gap-2 min-h-[92px] hover:border-lime/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-lime-fg" />
                      </div>
                      <span className="font-semibold text-sm text-bento-text">{section.label}</span>
                    </div>
                    <p className="text-[12px] text-bento-muted leading-snug">{section.tagline}</p>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
