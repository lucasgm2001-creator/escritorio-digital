'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MasterLead } from '@/lib/commercial/lead-hub-types'

// Master → Detail estilo Mail do iPad. O master vive no LAYOUT (persiste); ao selecionar um lead a
// navegação é soft → só o {children} (detalhe) troca, a lista não recarrega.
// Desktop / iPad landscape (lg+): master + detalhe simultâneos. Mobile / iPad portrait (<lg): master OU
// detalhe (recolhível) — lista → perfil → voltar.
export function CommercialMasterDetail({ leads, children }: { leads: MasterLead[]; children: React.ReactNode }) {
  const pathname = usePathname()
  const selectedId = pathname.startsWith('/comercial/lead/') ? pathname.slice('/comercial/lead/'.length).split('/')[0] : ''
  const hasSelection = selectedId.length > 0
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = q ? leads.filter(lead => `${lead.name} ${lead.company ?? ''}`.toLowerCase().includes(q)) : leads

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
      {/* MASTER — lista (sticky no desktop; some no mobile quando há detalhe aberto) */}
      <aside className={cn('lg:w-80 xl:w-96 shrink-0', hasSelection ? 'hidden lg:block' : 'block')}>
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] lg:min-h-0">
              <ChevronLeft className="w-4 h-4" /> Comercial
            </Link>
            <span className="font-tech text-[11px] text-bento-dim tabular-nums">{leads.length} leads</span>
          </div>

          <div className="flex items-center gap-2 bento-fx px-3 py-2">
            <Search className="w-4 h-4 text-bento-dim shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar lead…"
              className="w-full bg-transparent text-sm text-bento-text placeholder-bento-dim focus:outline-none"
            />
          </div>

          <ol className="space-y-1.5">
            {shown.length === 0 ? (
              <li className="text-sm text-bento-muted px-1 py-2">Nenhum lead encontrado.</li>
            ) : shown.map(lead => {
              const active = lead.id === selectedId
              return (
                <li key={lead.id}>
                  <Link
                    href={`/comercial/lead/${lead.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-bento border px-3 py-2.5 transition-colors min-h-[44px]',
                      active ? 'border-lime/40 bg-lime/10' : 'border-bento-border bg-bento-panel/40 hover:border-lime/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('text-sm font-semibold leading-snug break-words', active ? 'text-lime-fg' : 'text-bento-text')}>{lead.name}</span>
                      {lead.score != null && <span className="font-tech text-[11px] text-bento-dim shrink-0 tabular-nums">{lead.score}</span>}
                    </div>
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <span className="text-[11px] leading-snug text-bento-muted break-words">{lead.company ?? '—'}</span>
                      <span className="text-[10px] font-tech uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-bento-border text-bento-dim shrink-0 max-w-[50%] break-words text-right">{lead.stageName}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </aside>

      {/* DETAIL — o perfil do lead (some no mobile quando não há seleção) */}
      <main className={cn('flex-1 min-w-0', hasSelection ? 'block' : 'hidden lg:block')}>
        {hasSelection && (
          <Link href="/comercial/lead" className="lg:hidden inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] mb-2">
            <ChevronLeft className="w-4 h-4" /> Leads
          </Link>
        )}
        {children}
      </main>
    </div>
  )
}
