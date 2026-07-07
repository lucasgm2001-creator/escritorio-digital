# CRM-02A — Executive Dashboard Commercial (cockpit)

> Escopo: **exclusivamente** o Dashboard Comercial (`DashboardExecutivo.tsx`, rota `comercial/dashboard`). Nada de
> Radar/Funil/Contatos/Métricas. Objetivo: de "dashboard técnico" para **centro de comando** — a tela conta uma
> história. **Só reorganizar o que já existe**: zero métrica/dado/gráfico/cálculo novo. Presentation-only.

## Problemas encontrados (auditoria)
1. **Sem narrativa — muro de cards.** Ordem antiga: Hero → faixa Receita (6) → faixa Carteira (4) → vendedor/plano
   → Insights+Conversões → Funil. O olho batia em **10 cards** antes de qualquer "onde está o problema". Respondia
   *"quais são meus números?"*, não *"como está meu comercial?"*.
2. **Duplicação (4 KPIs repetidos).** `Receita Recebida`, `MRR`, `Conversão`, `Ticket Médio` apareciam no **hero**
   (`lg`) **e de novo** nas faixas (`sm`) — o mesmo número em dois pesos, diluindo o dinheiro.
3. **Insights enterrado.** A resposta literal a *"qual meu maior problema?"* era o **4º** bloco, dividindo linha
   com "Conversões por etapa" — parecia "mais um card".
4. **Hero sem foco de receita.** 4 cards de peso igual (Recebida/MRR/Conversão/Ticket) — Receita não pesava mais que
   Conversão, e a Receita **Prevista** (forte sinal de "como estamos") ficava escondida na faixa.

## O que foi ALTERADO (implementado)
Reorganização em **narrativa de 5 zonas**, só com dado existente:

| # | Zona (a pergunta) | Conteúdo |
|---|---|---|
| 1 | **Como estou hoje?** | Hero `lg` — **Receita Recebida · Receita Prevista · MRR · Conversão** (dinheiro lidera; Conversão fecha) |
| 2 | **Qual meu maior problema?** | **Insights** subiu para logo abaixo do hero, **largura total** (antes 4º, meia-largura) |
| 3 | **Como estão meus resultados?** | Faixa única **Resultados** `sm` — Semanal · Valor Fechado · ARR · Ticket · Clientes Ativos · Novos (dinheiro→contagens) |
| 4 | **Pipeline** | Funil por etapa (com gargalo) **+** Conversões por etapa (par) |
| 5 | **Quais detalhes consultar?** | Receita por vendedor · Receita por plano |

- **Dedup (Prioridade 3):** as faixas *Receita* (6) + *Carteira* (4) viraram **1 faixa Resultados (6)**. Os 10 KPIs
  agora aparecem **exatamente uma vez** cada — 0 repetição. (`Prevista` entrou no hero; `Ticket` desceu para
  Resultados; `Recebida/MRR/Conversão` saíram das faixas.)
- **Hierarquia (Prioridade 4):** Receita pesa mais (3 dos 4 cards do hero são receita; Conversão por último);
  hero `lg` domina, Resultados `sm` recua; dentro de Resultados, dinheiro primeiro e contagens por último.
- **Insights (Prioridade 5):** importante (2º, largura total) mas **calmo** — é `Panel`, não card `lg`, então **não
  compete** com a Receita do hero.

## O que NÃO foi alterado
SQL · Services · APIs · Hooks · Queries · Banco · **Métricas/dados/valores** · Regras · Responsividade · Design
System · Tokens · **MetricCard** e componentes compartilhados com o Hall. Nenhum cálculo novo: `vm`
(ExecutiveMetricsService) e `report` (ReportingService) chegam idênticos; mudou só a **ordem e o agrupamento** de
`MetricCard`/`Panel`/`BarList`. Copy dos dados intacta (labels iguais; só "Recebida (mês)" saiu por ser duplicata
do hero). Espaçamento mantido no ritmo existente (`space-y-6`, `gap-2.5`, `gap-4`) — já consistente, sem desperdício.

## Antes → Depois
| | Antes | Depois |
|---|---|---|
| Leitura | Hero → 10 cards → barras → Insights → Funil | Hero → **Problema** → Resultados → Pipeline → Detalhes |
| Nº de cards KPI | 4 + 6 + 4 = **14** (4 duplicados) | 4 + 6 = **10** (0 duplicados) |
| Insights | 4º, meia-largura, "mais um card" | **2º, largura total**, logo após o hero |
| Hero | Recebida · MRR · Conversão · Ticket | **Recebida · Prevista · MRR · Conversão** (receita lidera) |

## Impacto esperado
O vendedor abre e lê a operação como frase: *como estou → onde está o problema → resultados → pipeline → detalhes*.
Menos tempo até encontrar o problema (Insights subiu ~3 blocos) e até decidir a próxima ação. O dinheiro para de
aparecer 2× em pesos diferentes.

## Screenshots esperados
- **Topo:** hero com 4 números grandes liderados por Receita; **logo abaixo, faixa de Insights ocupando a largura
  toda** (ícones âmbar/verde/vermelho por tipo, com "gargalo" em destaque).
- **Meio:** uma única faixa "Resultados" de 6 cards menores; abaixo, Funil + Conversões lado a lado.
- **Base:** Receita por vendedor + por plano. **Nenhum KPI repetido** entre hero e faixa.
- **Mobile:** tudo empilha na mesma ordem (grids `lg:*` inertes) — narrativa idêntica.

## Riscos
**Baixo-médio.** É reorganização visível (o seu olho valida proporções), mas **presentation-only**: mesmos dados,
mesmos componentes, mesma responsividade; reversível em 1 commit. `tsc`+`lint`+`build` verdes; sem valor mágico
novo; nenhuma duplicata restante (cada KPI 1×, verificado). **Decisão interpretativa** (flag honesto): o hero passou
a incluir **Receita Prevista** no lugar de Ticket Médio (Prioridade 1 pede Prevista; Prioridade 4 pede "Conversão
depois") — se preferir Ticket no hero, é troca de 1 linha.

## Auto review (brutalmente honesto)
- **Ainda parece software interno?** Bem menos — o topo agora é um **cockpit** (dinheiro + problema em 2 blocos).
  O que ainda lembra "interno" são as **listas de barras** (vendedor/plano/conversões/funil): corretas e úteis, mas
  visualmente simples. Não mexi (é detalhe de consulta, e mexer arrisca sem seu olho).
- **Ainda parece coleção de cards?** Não como antes: virou **sequência** (5 zonas nomeadas). O hero + Insights leem
  como um par "situação/ação".
- **Entende a situação em <5s?** Sim para *dinheiro* e *maior problema* (topo). "Próxima ação" ainda é **inferida**
  do Insight, não explícita — o dado de "próxima ação/reunião do dia" não existe neste `vm`/`report` (é do
  Radar/Agenda); trazê-lo seria dado novo (proibido).
- **O que impede cobrar US$399?** (1) as listas de barras cruas (poderiam ganhar densidade/ranking visual); (2) o
  hero não tem 1 número **herói** acima dos outros (são 4 iguais); (3) "próxima ação" explícita exigiria cruzar com
  Radar/Agenda (fora do escopo de dado).
- **O que ficou deliberadamente para depois?** Peso extra no card-herói do hero (ex.: Receita ocupando 2 colunas),
  refino visual das barras, e qualquer integração de "próxima ação" — todos precisam do seu olho ou de dado novo.
- **Próxima sprint?** **CRM-02B = Funil** (a maior dívida de token do módulo, já mapeada na CRM-01) ou um polish
  visual das **listas de barras** do próprio Dashboard.

## Gates
`tsc` ✅ 0 · `lint` ✅ 0 · `build` ✅ 0 · dedup verificado (cada KPI 1×) · sem orphan/unused.
