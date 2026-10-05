'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search, Wallet, X } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { planLabel, type Client } from './types'
import type { ClientFinanceSummary } from '@/server/services/ClientsFinanceSummaryService'

// CLIENTES DESATIVADOS. O Hub mostra só quem está 'ativo', então encerrar um contrato fazia o cliente
// desaparecer da tela e o dossiê virava inalcançável — embora continuasse inteiro no banco e o Workspace
// (/clientes/[id] e subrotas) nunca tenha filtrado status. Esta aba é o caminho de volta.
//
// Entram status 'inativo' E 'prospect': o Hub também não mostra prospect, e é o mesmo problema de sumiço.
// Novos desativados aparecem aqui sozinhos — o critério é o status, não uma lista mantida à mão.
//
// Dois caminhos por cliente, de propósito:
//   · "Corrigir financeiro" vai direto ao /financeiro do Workspace, onde o editor de semanas já funciona
//     para cliente encerrado. É o atalho do caso real: a remuneração diz que ele pagou semanas que não
//     pagou, e desmarcar a semana lá tira a receita E a comissão na mesma transação (save_client_week).
//   · O nome abre o detalhe inline (mesmo ClienteDetalhe do Hub) para editar cadastro, plano e dossiê.

const usd = (v: number): string => formatCurrency(v, 'en-US', 'USD')

export function DesativadosTab({ clients, finance, onOpen }: {
  clients: Client[]
  finance?: Record<string, ClientFinanceSummary>
  onOpen: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const lista = useMemo(() => {
    const fora = clients.filter(c => c.status !== 'ativo')
    const filtrada = q
      ? fora.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q))
      : fora
    // Encerrados mais recentes primeiro: é quem você acabou de desativar que costuma precisar de ajuste.
    // Sem end_date (prospect que nunca fechou) cai para o fim, ordenado pela entrada.
    return [...filtrada].sort((a, b) => {
      const ea = a.end_date ?? '', eb = b.end_date ?? ''
      if (ea && eb) return eb.localeCompare(ea)
      if (ea) return -1
      if (eb) return 1
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }, [clients, q])

  const totalEncerrados = clients.filter(c => c.status === 'inativo').length
  const totalProspects = clients.filter(c => c.status === 'prospect').length

  return (
    <div className="p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-bento-text">
            {totalEncerrados} encerrado{totalEncerrados === 1 ? '' : 's'}
            {totalProspects > 0 && <span className="text-bento-muted"> · {totalProspects} prospect{totalProspects === 1 ? '' : 's'}</span>}
          </p>
          <p className="font-tech text-caption text-bento-muted">
            O dossiê continua completo. Dá para editar cadastro, plano e financeiro — e a correção do
            financeiro reflete na remuneração.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bento-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar encerrado…"
            className="w-full rounded-btn border border-bento-border bg-bento-bg py-2 pl-9 pr-8 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bento-muted hover:text-bento-text">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-bento border border-dashed border-bento-border p-10 text-center text-sm text-bento-muted">
          {q ? 'Nenhum encerrado com esse nome.' : 'Nenhum cliente desativado.'}
        </p>
      ) : (
        <div className="space-y-2">
          {lista.map(c => {
            const fin = finance?.[c.id]
            return (
              <div key={c.id} className="bento-fx flex flex-wrap items-center gap-3 p-3.5 min-w-0 transition-colors hover:border-lime/40">
                <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-bento-border bg-bento-bg">
                    <span className="text-sm font-bold text-bento-muted">{(c.name || '?')[0]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bento-text">{c.name}</p>
                    <p className="truncate font-tech text-caption text-bento-muted">
                      {[c.company, c.city].filter(Boolean).join(' · ') || 'Sem empresa'}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <Campo rotulo="Situação" valor={c.status === 'prospect' ? 'Prospect' : 'Encerrado'} />
                  <Campo rotulo="Encerrado em" valor={c.end_date ? formatDateBR(c.end_date) : '—'} />
                  <Campo rotulo="Plano" valor={planLabel(c.plan_weekly)} />
                  <Campo rotulo="Semanas pagas" valor={fin ? String(fin.pagos) : '—'} destaque />
                  <Campo rotulo="Recebido" valor={fin ? usd(fin.totalRecebido) : '—'} />
                </div>

                {c.end_reason && (
                  <p className="w-full min-w-0 border-t border-bento-border/60 pt-2 text-xs text-bento-dim break-words">
                    <span className="font-tech text-[9px] uppercase tracking-wide text-bento-muted">Motivo · </span>
                    {c.end_reason}
                  </p>
                )}

                <div className="flex flex-none items-center gap-1.5">
                  <Link href={`/clientes/${c.id}/financeiro`}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn border border-bento-border px-3 text-xs font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text">
                    <Wallet className="h-3.5 w-3.5" /> Corrigir financeiro
                  </Link>
                  <Link href={`/clientes/${c.id}`} aria-label={`Abrir dossiê de ${c.name}`}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn border border-bento-border px-3 text-xs font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text">
                    Dossiê <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-tech text-[9px] uppercase tracking-wide text-bento-muted">{rotulo}</p>
      <p className={cn('truncate text-xs tabular-nums', destaque ? 'font-semibold text-bento-text' : 'text-bento-dim')}>{valor}</p>
    </div>
  )
}
