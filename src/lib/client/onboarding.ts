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
  ajuda: string             // o que decidir nesta etapa — some quando a etapa é resolvida
  // Só ALGUMAS etapas pedem texto. "Boas-vindas" é conversa e não tem resposta para anotar; "Domínio do
  // site" tem. Campo em toda etapa faria o formulário parecer obrigatório e travaria a reunião.
  resposta?: { rotulo: string; exemplo: string }
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'boas_vindas', titulo: 'Boas-vindas e expectativas',
    ajuda: 'Apresentar a equipe e combinar canal e frequência de contato.' },
  { key: 'contrato', titulo: 'Confirmar dados do contrato',
    ajuda: 'Plano, valor, de quanto em quanto tempo cobra e forma de pagamento.' },
  { key: 'negocio', titulo: 'Entender o negócio',
    ajuda: 'Serviço, ticket, região de atuação e diferencial.',
    resposta: { rotulo: 'O que o cliente faz', exemplo: 'Ex.: limpeza residencial, ticket US$ 180, Orlando' } },
  { key: 'metas', titulo: 'Metas e o que é sucesso',
    ajuda: 'Quantos leads e fechamentos o cliente espera por mês.',
    resposta: { rotulo: 'Meta combinada', exemplo: 'Ex.: 40 leads/mês, 8 fechamentos' } },
  { key: 'dominio', titulo: 'Domínio do site',
    ajuda: 'Definir qual domínio será usado na landing page.',
    resposta: { rotulo: 'Domínio escolhido', exemplo: 'Ex.: cleanpro-orlando.com' } },
  { key: 'acessos_trafego', titulo: 'Acessos de tráfego',
    ajuda: 'Meta Business e Google Ads — solicitar acesso ou criar as contas.',
    resposta: { rotulo: 'Situação dos acessos', exemplo: 'Ex.: BM liberado; Google Ads a criar' } },
  { key: 'whatsapp', titulo: 'WhatsApp e atendimento',
    ajuda: 'Número de destino e quem responde as mensagens.',
    resposta: { rotulo: 'Número e responsável', exemplo: 'Ex.: +1 407 555-0134, atende a Ana' } },
  { key: 'criativos', titulo: 'Landing page e criativos',
    ajuda: 'Aprovar a página e a primeira leva de criativos.',
    resposta: { rotulo: 'O que foi aprovado', exemplo: 'Ex.: 3 criativos aprovados, LP no ar dia 25' } },
  { key: 'drive', titulo: 'Pasta no Drive',
    ajuda: 'Criar e vincular a pasta de materiais do cliente.',
    resposta: { rotulo: 'Link da pasta', exemplo: 'Ex.: link da pasta compartilhada' } },
  { key: 'rotina', titulo: 'Combinados de rotina',
    ajuda: 'Dia do relatório e reunião recorrente na agenda.',
    resposta: { rotulo: 'Rotina combinada', exemplo: 'Ex.: relatório toda segunda, call quinzenal' } },
]

/** Primeira etapa ainda SEM desfecho — é a que fica aberta na reunião. null = roteiro terminado. */
export function proximaEtapaAberta(decididas: Set<string>): string | null {
  return ONBOARDING_STEPS.find(s => !decididas.has(s.key))?.key ?? null
}

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
