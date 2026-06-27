// Conversão GERAL (estado ATUAL do funil) — definição ÚNICA, usada igual no Funil (rodapé) e no Mapa
// (Hall), pra os dois mostrarem EXATAMENTE o mesmo número. NÃO é dinheiro: só contagem/percentual de
// exibição (não toca comissão/receita). Não confundir com a conversão DO PERÍODO da aba Métricas.
//
//   conversão geral = fechados ÷ (total de leads NÃO-Lixeira)
//
// (denominador = tudo menos a Lixeira: inclui ativos, perdidos, no-show etc. — espelha o rodapé do Funil.)

function funnelConversionPct(leads: { status: string }[]): number {
  const naoLixeira = leads.filter(l => l.status !== 'lixeira').length
  const fechados = leads.filter(l => l.status === 'fechado').length
  return naoLixeira > 0 ? (fechados / naoLixeira) * 100 : 0
}

// Rótulo padronizado (1 casa decimal) — Funil e Mapa renderizam o MESMO texto.
export function funnelConversionLabel(leads: { status: string }[]): string {
  return funnelConversionPct(leads).toFixed(1)
}
