// Roteiro da reunião de ONBOARDING (ONBOARDING-001).
//
// ► ESTE É O ÚNICO LUGAR A EDITAR PARA MUDAR O ROTEIRO. ◄
// A lista abaixo é um RASCUNHO, montado a partir do que o sistema já guarda do cliente (plano, cobrança,
// tráfego, WhatsApp/Z-API, Drive, agenda). Vai ser substituída pelo roteiro real. Trocar aqui basta:
// a tela, a persistência e o progresso derivam desta constante, nada é duplicado.
//
// `key` é o identificador GRAVADO no banco. Não reaproveite uma key para outra etapa: o histórico de
// clientes que já passaram pelo onboarding ficaria apontando para a pergunta errada. Etapa removida
// simplesmente some da tela; a linha antiga continua no banco, sem atrapalhar.

export type OnboardingStep = {
  key: string
  titulo: string
  ajuda: string          // o que decidir nesta etapa — some quando a etapa é resolvida
  exemploResposta: string // placeholder do campo, para deixar claro o que se espera escrever
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'boas_vindas', titulo: 'Boas-vindas e expectativas',
    ajuda: 'Apresentar a equipe e combinar canal e frequência de contato.',
    exemploResposta: 'Ex.: contato pelo WhatsApp, retorno em até 1 dia útil' },
  { key: 'contrato', titulo: 'Confirmar dados do contrato',
    ajuda: 'Plano, valor, de quanto em quanto tempo cobra e forma de pagamento.',
    exemploResposta: 'Ex.: Growth, US$ 190/semana, PIX' },
  { key: 'negocio', titulo: 'Entender o negócio',
    ajuda: 'Serviço, ticket, região de atuação e diferencial.',
    exemploResposta: 'Ex.: limpeza residencial, ticket US$ 180, Orlando' },
  { key: 'metas', titulo: 'Metas e o que é sucesso',
    ajuda: 'Quantos leads e fechamentos o cliente espera por mês.',
    exemploResposta: 'Ex.: 40 leads/mês, 8 fechamentos' },
  { key: 'dominio', titulo: 'Domínio do site',
    ajuda: 'Definir qual domínio será usado na landing page.',
    exemploResposta: 'Ex.: cleanpro-orlando.com' },
  { key: 'acessos_trafego', titulo: 'Acessos de tráfego',
    ajuda: 'Meta Business e Google Ads — solicitar acesso ou criar as contas.',
    exemploResposta: 'Ex.: acesso ao BM liberado; Google Ads a criar' },
  { key: 'whatsapp', titulo: 'WhatsApp e atendimento',
    ajuda: 'Número de destino, instância e template da primeira mensagem.',
    exemploResposta: 'Ex.: +1 407 555-0134, template “Olá, vi seu interesse…”' },
  { key: 'criativos', titulo: 'Landing page e criativos',
    ajuda: 'Aprovar a página e a primeira leva de criativos.',
    exemploResposta: 'Ex.: 3 criativos aprovados, LP no ar dia 25' },
  { key: 'drive', titulo: 'Pasta no Drive',
    ajuda: 'Criar e vincular a pasta de materiais do cliente.',
    exemploResposta: 'Ex.: link da pasta compartilhada' },
  { key: 'rotina', titulo: 'Combinados de rotina',
    ajuda: 'Dia do relatório e reunião recorrente na agenda.',
    exemploResposta: 'Ex.: relatório toda segunda, call quinzenal' },
]

export type OnboardingStatus = 'concluido' | 'pendente'

/** Progresso: só 'concluido' conta. 'pendente' é etapa que foi tratada e NÃO resolveu — não é avanço. */
export function onboardingProgress(porEtapa: Map<string, OnboardingStatus>): {
  concluidas: number; pendentes: number; abertas: number; total: number; pct: number
} {
  const total = ONBOARDING_STEPS.length
  let concluidas = 0, pendentes = 0
  for (const s of ONBOARDING_STEPS) {
    const st = porEtapa.get(s.key)
    if (st === 'concluido') concluidas++
    else if (st === 'pendente') pendentes++
  }
  return { concluidas, pendentes, abertas: total - concluidas - pendentes, total,
    pct: total > 0 ? Math.round((concluidas / total) * 100) : 0 }
}
