'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Power, CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { useToast } from '@/components/ui/toast'
import { deactivateClientAction, reactivateClientAction } from '@/app/(dashboard)/clientes/client-write-actions'

// DESATIVAR CLIENTE no fim do Resumo (CLIENT-DESATIVAR-001).
//
// A ação existia só como um link de texto pequeno dentro do detalhe inline do Hub — fora do Workspace,
// que é onde se olha o cliente para decidir. Encerrar contrato é decisão de peso e precisa estar onde a
// decisão acontece, com tamanho de botão e não de link.
//
// Fica no FIM do Resumo de propósito: é o último passo depois de ver plano, financeiro e atividade.
// Botão grande no computador (onde o trabalho administrativo acontece) e largura total no celular, onde
// qualquer alvo menor que isso vira erro de toque.
//
// Confirmação em duas etapas com motivo opcional. O motivo não é enfeite: ele aparece na aba Desativados
// e é a única explicação de por que o contrato acabou quando alguém revisitar meses depois.

export function DesativarClienteBox({ clientId, clientName, status, endDate, endReason, podeEditar }: {
  clientId: string
  clientName: string
  status: string
  endDate?: string | null
  endReason?: string | null
  podeEditar: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, startSalvar] = useTransition()
  const [reativando, setReativando] = useState(false)
  // Data de recomeço: hoje por padrão, que é o caso comum — o cliente voltou agora. Mas é editável
  // porque a volta costuma ser combinada antes de alguém lembrar de mexer no sistema.
  const [recomeco, setRecomeco] = useState(() => new Date().toISOString().slice(0, 10))

  const reativar = () => startSalvar(async () => {
    const r = await reactivateClientAction(clientId, recomeco)
    if (!r.ok) { toast({ type: 'error', message: r.error || 'Não foi possível reativar o cliente.' }); return }
    setReativando(false)
    toast({
      type: 'success',
      message: r.semanasFechadas > 0
        ? `${clientName} reativado a partir de ${formatDateBR(r.restartDate)}. ${r.semanasFechadas} semana(s) do período sem contrato foram anuladas.`
        : `${clientName} reativado a partir de ${formatDateBR(r.restartDate)}.`,
    })
    router.refresh()
  })

  // Cliente já encerrado: mostra o estado (data e motivo) e oferece a volta. Esconder por completo
  // deixaria "quando e por que isso acabou?" sem resposta justamente na tela que resume o cliente.
  if (status !== 'ativo') {
    return (
      <div className="rounded-bento border border-bento-border bg-bento-bg/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-bento-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-bento-text">
              Contrato encerrado{endDate ? ` em ${formatDateBR(endDate)}` : ''}
            </p>
            <p className="mt-0.5 text-note text-bento-muted">
              {endReason?.trim()
                ? `Motivo: ${endReason.trim()}`
                : 'Sem motivo registrado. O histórico e o financeiro continuam disponíveis nas abas acima.'}
            </p>
          </div>
        </div>

        {podeEditar && !reativando && (
          <button type="button" onClick={() => setReativando(true)}
            className={cn('mt-4 inline-flex w-full items-center justify-center gap-2 rounded-btn border px-6 text-sm font-semibold transition-colors',
              'min-h-[52px] sm:w-auto sm:min-w-[220px]',
              'border-lime/50 bg-lime/10 text-lime-fg hover:border-lime hover:bg-lime/20')}>
            <RotateCcw className="h-4 w-4" /> Reativar cliente
          </button>
        )}

        {podeEditar && reativando && (
          <div className="mt-4 rounded-btn border border-lime/40 bg-lime/[0.06] p-4">
            <p className="text-sm font-semibold text-bento-text">Reativar “{clientName}”</p>
            <p className="mt-1 text-note text-bento-muted">
              A cobrança volta a correr a partir da data abaixo, no mesmo dia da semana de sempre. As
              semanas do período sem contrato entram como anuladas — sem elas, o automático as marcaria
              como pagas e criaria receita que nunca existiu.
            </p>

            <label className="mt-3 block max-w-xs">
              <span className="font-tech text-caption uppercase tracking-label text-bento-muted">
                Reativado a partir de
              </span>
              <input type="date" value={recomeco} onChange={e => setRecomeco(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Escape') setReativando(false) }}
                className="mt-1 w-full rounded-btn border border-bento-border bg-bento-bg px-3 py-2.5 text-sm text-bento-text focus:border-lime focus:outline-none" />
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={reativar} disabled={salvando || !recomeco}
                className="bento-btn inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn px-6 text-sm font-semibold disabled:opacity-50">
                <RotateCcw className="h-4 w-4" />{salvando ? 'Reativando…' : 'Confirmar reativação'}
              </button>
              <button type="button" onClick={() => setReativando(false)} disabled={salvando}
                className="inline-flex min-h-[48px] items-center justify-center rounded-btn border border-bento-border px-6 text-sm font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!podeEditar) return null

  const desativar = () => startSalvar(async () => {
    const r = await deactivateClientAction(clientId, motivo.trim() || null)
    if (!r.ok) { toast({ type: 'error', message: r.error || 'Não foi possível desativar o cliente.' }); return }
    setConfirmando(false)
    toast({ type: 'success', message: `${clientName} foi encerrado em ${formatDateBR(r.endDate)}.` })
    router.refresh()
  })

  if (!confirmando) {
    return (
      <div className="rounded-bento border border-bento-border bg-bento-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-bento-text">Encerrar o contrato deste cliente</p>
            <p className="mt-0.5 text-note text-bento-muted">
              Marca como inativo e registra a data de hoje. Não altera comissões nem recebimentos já
              lançados, e o dossiê continua acessível em Clientes → Desativados.
            </p>
          </div>
          <button type="button" onClick={() => setConfirmando(true)}
            className={cn('inline-flex w-full items-center justify-center gap-2 rounded-btn border px-6 text-sm font-semibold transition-colors',
              'min-h-[52px] sm:w-auto sm:min-w-[220px]',
              'border-red-500/40 bg-red-500/[0.07] text-red-500 hover:border-red-500/70 hover:bg-red-500/15 dark:text-red-300')}>
            <Power className="h-4 w-4" /> Desativar cliente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-bento border border-red-500/40 bg-red-500/[0.06] p-4 sm:p-5">
      <p className="text-sm font-semibold text-bento-text">Desativar “{clientName}”?</p>
      <p className="mt-1 text-note text-bento-muted">
        O contrato é encerrado com a data de hoje. Comissões e recebimentos já lançados permanecem como
        estão — isto muda só a situação do cliente.
      </p>

      <label className="mt-3 block">
        <span className="font-tech text-caption uppercase tracking-label text-bento-muted">
          Motivo <span className="normal-case text-bento-dim">(opcional, aparece em Desativados)</span>
        </span>
        <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Escape') setConfirmando(false) }}
          placeholder="Ex.: não renovou o contrato, parou de responder"
          className="mt-1 w-full rounded-btn border border-bento-border bg-bento-bg px-3 py-2.5 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={desativar} disabled={salvando}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn bg-red-500/90 px-6 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50">
          <Power className="h-4 w-4" />{salvando ? 'Encerrando…' : 'Confirmar e encerrar'}
        </button>
        <button type="button" onClick={() => setConfirmando(false)} disabled={salvando}
          className="inline-flex min-h-[48px] items-center justify-center rounded-btn border border-bento-border px-6 text-sm font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text disabled:opacity-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}
