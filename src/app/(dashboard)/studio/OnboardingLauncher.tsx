'use client'

import { useEffect, useMemo, useState } from 'react'
import { Rocket, Search } from 'lucide-react'
import { OnboardingForm, type OnboardingRow } from './OnboardingForm'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// Entrada da reunião de ONBOARDING (ONBOARDING-001). O Studio é onde as reuniões começam, então o
// onboarding começa aqui também — mas o roteiro vive no workspace do cliente, que é onde o contexto está.
// Esta tela faz UMA coisa: atrelar a reunião a um cliente e abrir o checklist. Sem etapa intermediária,
// porque é feita com o cliente já na linha.
//
// Busca por digitação em vez de lista rolável: com dezenas de clientes, achar na lista é mais lento do
// que escrever três letras do nome. Enter abre o primeiro resultado — o caminho mais curto possível.
//
// Escolher o cliente abre o formulário AQUI (ONBOARDING-002), sem navegar para o workspace: esta é a tela
// compartilhada com o cliente e ela não pode dar passagem para financeiro/timeline.

type ClienteOpcao = { id: string; name: string; company: string | null; status: string | null }

export function OnboardingLauncher() {
  const supabase = createClient()
  const [escolhido, setEscolhido] = useState<ClienteOpcao | null>(null)
  const [rows, setRows] = useState<OnboardingRow[] | null>(null)
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    supabase.from('clients')
      .select('id, name, company, status')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return
        setClientes((data ?? []) as ClienteOpcao[])
        setCarregando(false)
      })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    // Sem busca, mostra os mais RECENTES: onboarding é de cliente que acabou de fechar.
    if (!q) return clientes.slice(0, 8)
    return clientes.filter(c =>
      c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q)).slice(0, 8)
  }, [clientes, busca])

  // Abre o roteiro do cliente sem sair do Studio. Carrega o que já foi decidido (reunião pode ser retomada).
  const abrir = async (c: ClienteOpcao) => {
    setEscolhido(c); setRows(null)
    const { data } = await supabase.from('client_onboarding')
      .select('step_key, status, resposta').eq('client_id', c.id)
    setRows((data ?? []) as OnboardingRow[])
  }

  if (escolhido) {
    if (!rows) return <p className="p-6 text-center text-sm text-bento-muted">Abrindo roteiro…</p>
    return (
      <OnboardingForm clientId={escolhido.id} clientName={escolhido.name} rows={rows}
        onVoltar={() => { setEscolhido(null); setRows(null) }} />
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-bento border border-lime/30 bg-lime/10">
          <Rocket className="h-5 w-5 text-lime-fg" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-bento-text">Reunião de onboarding</h2>
          <p className="text-note text-bento-muted">Escolha o cliente para abrir o roteiro e começar.</p>
        </div>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bento-muted" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && filtrados[0]) void abrir(filtrados[0]) }}
          autoFocus
          placeholder="Escreva o nome do cliente…"
          aria-label="Buscar cliente"
          className="w-full rounded-btn border border-bento-border bg-bento-bg py-2.5 pl-9 pr-3 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />
      </label>

      <div className="space-y-1.5">
        {carregando ? (
          <p className="py-6 text-center text-sm text-bento-muted">Carregando clientes…</p>
        ) : filtrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-bento-muted">Nenhum cliente com esse nome.</p>
        ) : filtrados.map(c => (
          <button key={c.id} type="button" onClick={() => void abrir(c)}
            className="flex w-full items-center gap-3 rounded-bento border border-bento-border p-3 text-left transition-colors hover:border-lime/60 hover:bg-bento-bg">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-lime/15 font-display text-xs font-bold text-lime-fg">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-bento-text">{c.name}</span>
              <span className="block truncate font-tech text-caption text-bento-muted">{c.company || 'Sem empresa'}</span>
            </span>
            <span className={cn('flex-none rounded-full border px-2 py-0.5 font-tech text-[9px] uppercase',
              c.status === 'ativo' ? 'border-lime/30 text-lime-fg' : 'border-bento-border text-bento-dim')}>
              {c.status === 'ativo' ? 'Ativo' : c.status ?? '—'}
            </span>
          </button>
        ))}
      </div>

      {!busca && !carregando && clientes.length > 8 && (
        <p className="text-center font-tech text-caption text-bento-muted">
          Mostrando os 8 mais recentes. Escreva o nome para achar os outros.
        </p>
      )}
    </div>
  )
}
