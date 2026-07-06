# UX-PRODUCT-REVIEW-001 — Auditoria de produto (visão de fundador de SaaS premium)

> Lente: **um usuário usando o sistema 8h/dia**, e **eu cobrando US$ 399/mês** por ele.
> Escopo: **só UX** — nenhuma regra de negócio, banco, SQL, métrica, permissão, service, repository,
> server action, design system, responsividade ou token foi alterado. Este documento é **diagnóstico**;
> a implementação está represada (ver Parte 10).
> Método: leitura direta do código de cada tela (4 mapeamentos paralelos + auditoria própria). Data: 06/07/2026.

---

## Sumário executivo

O sistema é um **excelente instrumento interno** — denso, poderoso, eficiente para quem já sabe onde tudo
fica. Mas hoje ele **parece software da equipe, não produto vendido**. O padrão que se repete em quase toda
tela: **muros de métricas de peso igual, ação primária sem destaque, informação de operação sempre visível,
e vocabulário de sistema** (enums, jargão, disclaimers). Falta a camada de **clareza, hierarquia e narrativa**
que um cliente pagante espera.

**3 alavancas de maior retorno:**
1. **Hierarquia sobre densidade** — em cada tela, eleger 1 herói + 3 apoios; o resto sob demanda.
2. **Ação primária óbvia** — 1 CTA claro por tela; parar de competir com 10 botões do mesmo peso.
3. **Linguagem de produto** — falar em resultado do negócio ("João virou lead", "3 clientes em atraso →
   ver"), não em ação de sistema ("Confirmar create_lead", "client_payments").

**Pior ofensor:** Tráfego (v0.1 — 100% placeholder vendido como feature). **Melhor tela:** Mapa (showpiece).

---

## Parte 1 — Walkthrough por tela

Para cada tela: **Onde clico? · O que é mais importante? · O que compete por atenção? · O que poderia sumir?**

### Hall › Visão Geral
- **Onde clico?** Ambíguo — é um painel de leitura. Os MetricCards são clicáveis (têm `href`) mas parecem
  cards estáticos. Não há CTA.
- **Mais importante?** "Prioridades de hoje" + Agenda. Mas ficam competindo com 3 grupos de KPI, receita
  por vendedor/plano, atividades e notícias.
- **Competindo:** alertas (âmbar) + até 15 KPI cards (3 grupos × 5) + 2 painéis de receita + atividades +
  agenda + notícias, tudo no mesmo peso.
- **Poderia sumir/colapsar:** Notícias do setor (secundário), Atividades recentes (secundário). Reduzir os
  3 grupos de KPI para 1 "resumo do dia" e mandar o resto para o Comercial/Financeiro.

### Hall › Mapa  *(melhor tela do produto)*
- **Onde clico?** No mapa (interativo). Claro.
- **Mais importante?** O próprio mapa 3D/vidro — é o showpiece.
- **Competindo:** pouca coisa (o Panel fica sem label pra não duplicar o header do mapa). Bom.
- **Poderia sumir:** nada. É a tela mais "produto" do sistema.

### Hall › Tarefas
- **Onde clico?** "Nova tarefa" (header) — razoável. Mas há **3 caminhos de criação**: botão "Nova tarefa",
  "Resumo do dia" e o composer de texto (IA). Redundância de intenção.
- **Mais importante?** As atrasadas (âmbar) — bem sinalizado.
- **Competindo:** os 3 caminhos de criação + filtros + seções.
- **Poderia sumir:** consolidar as 3 entradas de criação em 1 primária + 1 avançada.

### Hall › Relatório
- **Onde clico?** Seletor de período + "Baixar PDF". Claro.
- **Mais importante?** Funil do período + receita. Já está hierarquizado (fiz recente).
- **Competindo:** muitos blocos (funil, secundárias, receita, comparativo, carteira, gargalos, insights) —
  denso, mas cada um tem propósito.
- **Poderia sumir:** "Secundárias" e "gargalos" poderiam ser colapsáveis (sob demanda).

### Hall › Agente
- **Onde clico?** Campo de input (claro) + barra de confirmação (quando aparece).
- **Mais importante?** A conversa + a barra de confirmar ação.
- **Competindo:** timestamps em toda mensagem + painel de capacidades repetindo o empty state.
- **Poderia sumir:** timestamps (on-hover), e o segundo "o que eu faço" (empty state já diz).

### Comercial  *(mais poderoso, mais "interno")*
- **Onde clico?** "Novo Lead" (verde) — único botão claro. Mover lead = **arrastar** (escondido) ou expandir
  card → "Mover para".
- **Mais importante?** Deveria ser a **fila do dia (Radar)** — mas está na 2ª aba, escondida. O default é o
  Funil com **colunas colapsadas** (80% dos leads atrás de um clique).
- **Competindo:** **3 vocabulários de cor simultâneos** (tom da fase, dots de calor, badges do card) + 20+
  elementos clicáveis num card expandido + chips de período + legenda.
- **Poderia sumir/colapsar:** legenda (→ tooltip), chips de período (→ ícone de filtro), colunas colapsadas
  (expandir por padrão os leads ativos).

### Tráfego  *(pior tela — v0.1)*
- **Onde clico?** Nada óbvio. O único elemento acionável (conectar conta) está enterrado na rota "Contas".
- **Mais importante?** Deveria ser "Conecte sua 1ª conta". Em vez disso: 15 KPI cards mostrando "—".
- **Competindo:** 15 KPIs vazios + 8 cards de plataforma "off" + 2 painéis de IA/Alertas estáticos +
  nav 3-way (sidebar + quick-actions + breadcrumb) → a mesma mensagem "conecte contas" repetida 3×.
- **Poderia sumir:** ~80% da tela até existir 1 conta conectada. Rotas derivadas (Conjuntos/Anúncios/
  Criativos) deveriam ser fantasmas até haver campanha.

### Financeiro
- **Onde clico?** Em lugar nenhum — dashboard **100% passivo** (sem drill-down). "Clientes em atraso = 3"
  não linka para os 3 clientes.
- **Mais importante?** Receita Recebida (card 3xl/4xl, bem grande). Bom.
- **Competindo:** 11–12 KPI cards de **peso igual** por linha (grid-cols-6), cobrança com 6 estados
  idênticos, 3 painéis de barras seguidos.
- **Poderia sumir:** disclaimer apologético ("não é caixa") → virar rótulo claro; gráfico de 6 meses quando
  só há 2 meses de dado; metade dos KPIs → atrás de "mais indicadores".

### Clientes (Admin)
- **Onde clico?** Duplo CTA por card: botão do card inteiro (`onOpen`, abre detalhe) **e** "Abrir workspace".
  Dois caminhos, uma intenção.
- **Mais importante?** Abrir o workspace do cliente. Ok, mas competido pelo detalhe.
- **Competindo:** status WhatsApp em **3 lugares** (dot no card + campo no detalhe + toggle na aba
  Integrações); micro-grid financeiro (recebido/próxima cobrança/semanas pendentes) em **todo** card.
- **Poderia sumir:** micro-grid financeiro (→ tooltip/detalhe); detalhe do cliente hoje mostra schema cru
  (assigned_name, fuso, drive_folder_url) — 80% poderia ficar oculto por padrão.

### Remuneração (Admin)
- **Onde clico?** "Novo Vendedor" (lime). Mas "Alterar meu PIN" compete no header; e cada vendedor exige
  **PIN** para abrir.
- **Mais importante?** Estrutura da equipe + comissões. Mas está tudo aninhado: Perfil › Aba › Colapsável ›
  Form.
- **Competindo:** **salário fixo aparece 2×** (aba Metas read-only + aba Comissão editável); "comissão do
  mês" repetida (card + barra de progresso); templates read-only em cards idênticos.
- **Poderia sumir:** PIN por vendedor (→ gate por papel na página); um dos dois salários; 5 cards de header
  que empurram as abas pra baixo no mobile.

### Configurações
- **Onde clico?** Master-detail (lista de seções à esquerda). Ok.
- **Mais importante?** Tema, Conta, Integrações. Mas competem com ~15 seções, várias **placeholder**
  (Sobre, "IA indisponível", "Tráfego requer integração").
- **Competindo:** volume de seções; seções quase vazias dão sensação de inacabado.
- **Poderia sumir:** consolidar (Tema+Aparência+Acessibilidade → "Aparência"); esconder as placeholder até
  existirem; "Andares" é nicho.

### Perfil  *(limpo após migração do DS)*
- **Onde clico?** "Salvar alterações". Claro.
- **Mais importante?** Nome/foto/dados. Ok.
- **Competindo:** pouco. Duas Panels + aba "Minha Remuneração". Razoável.
- **Poderia sumir:** nada crítico.

---

## Parte 2 — Desperdício visual (consolidado)

| Tipo | Onde | Recomendação |
|---|---|---|
| **Informação repetida** | WhatsApp status em 3 lugares (Clientes); salário fixo 2× (Remuneração); receita recebida card+contexto (Financeiro); contagem de fase em coluna+pizza (Comercial) | Uma fonte visual por dado; as outras viram derivadas/ocultas |
| **Cards demais, peso igual** | 15 KPIs (Hall), 12 KPIs/linha (Financeiro), 15 KPIs "—" (Tráfego) | 1 herói + 3 apoios; resto atrás de "mais indicadores" |
| **Containers/divisórias inúteis** | `bento-fx` envolvendo 80+ elementos (Comercial); linha `h-px` repetida 5× (Financeiro GroupHeader); headers de seção que repetem os títulos dos cards | Remover moldura quando não agrupa nada novo |
| **Botões repetidos** | Atendeu/Mensagem/Não Atendeu no card **e** no LeadDiary (Comercial); duplo CTA por card (Clientes); 3 caminhos de criar tarefa (Tarefas) | 1 caminho primário; duplicatas viram atalho contextual |
| **Componente que podia ser texto** | Barra de confirmação do Agente (enum) → frase legível; disclaimers do Financeiro → rótulo | — |
| **Texto que podia ser badge (e vice-versa)** | "WhatsApp ativo" (texto) já é dot — escolher um; legendas de calor (texto) já são dots | — |
| **Espaço/labels redundantes** | Section labels repetindo o mesmo padrão CAPS antes de cada bloco (Tráfego, Financeiro) | Usar o label do Panel; não repetir header + subtítulo |

---

## Parte 3 — Excesso de informação (mostrar essencial; resto sob demanda)

- **Comercial:** colunas do funil **expandidas por padrão** para leads ativos; chips de período e legenda →
  sob demanda; card expandido (20+ elementos) → drawer em 2 estágios.
- **Financeiro:** 3–4 KPIs no topo; cobrança detalhada e gráfico 6m → colapsáveis; painéis de barra → abas.
- **Tráfego:** esconder Gestão/Medição/Inteligência até haver 1 conta; 15 KPIs → 4.
- **Clientes:** micro-grid financeiro do card → só no detalhe; detalhe → esconder 80% dos campos de schema.
- **Remuneração:** header de 5 cards → 3; campos de meta (data/notas) → aparecem só quando há meta.
- **Hall:** Notícias/Atividades colapsadas; 3 grupos de KPI → 1 resumo.
- **Agente:** timestamps on-hover; painel de capacidades só no empty state.

---

## Parte 4 — Ações escondidas

| Ação importante | Onde está hoje | Deveria estar |
|---|---|---|
| Mover lead (arrastar) | Só drag no desktop (sem dica); no mobile só em modo "Organizar" | Dica visível + botão "Mover" sempre no card |
| **Radar / fila do dia** | 2ª aba, rotulada "Radar" | Visão **default** do Comercial ("Hoje"/"Próximas ações") |
| Conectar conta de anúncio | Enterrada na rota "Contas" | Botão herói no dashboard do Tráfego |
| Gerar/baixar relatório (Tráfego) | 4 cards descritivos, **sem** botão | CTA "Gerar" em cada tipo |
| Ver clientes em atraso | Número no Financeiro, sem link | Card clicável → lista |
| Gerir/reordenar prateleiras | Sem drag/editar posição (Clientes) | Ação no header de cada prateleira |
| Comissão por vendedor | Aninhada atrás de PIN + aba + colapsável | Gate por papel; nível único de acesso |
| Corrigir ação do Agente | Padrão de correção por texto (invisível) | Dica/exemplo persistente |

---

## Parte 5 — Oportunidades de automação (o sistema podia fazer sozinho)

- **Lembrar última escolha:** período do Relatório/Comercial, filtro de responsável (Tarefas), aba ativa do
  Hall, ordem/colapso das colunas do funil.
- **Selecionar padrão inteligente:** ao criar lead já cliente → pré-selecionar o modo; ao concluir tarefa de
  lead → abrir o SituationDrawer (já existe) com a próxima ação sugerida.
- **Filtrar automático:** Tráfego esconder rotas derivadas sem dado; Financeiro esconder gráfico de meses
  sem movimento.
- **Abrir modal automaticamente:** primeiro acesso sem lead → abrir "Novo Lead" com dica; primeiro acesso
  ao Tráfego → wizard de conexão.
- **Insights acionáveis (Agente):** trocar "o que eu faço" por "3 leads aguardando contato · 1 reunião hoje ·
  2 clientes em atraso" — puxando dos dados que já existem.
- **Atalhos de teclado:** `N` novo lead/tarefa, `/` buscar, `G+H/G+C` navegar (produto premium).

---

## Parte 6 — Inconsistências (padronizar)

**Verbos de botão** — hoje convivem Salvar / Confirmar / Aplicar / Atualizar para a mesma intenção. Padrão
proposto:
- **Salvar** = persistir formulário (Perfil, Config, metas).
- **Confirmar** = ação irreversível/destacada (excluir, mover, confirmar ação do Agente).
- **Aplicar** = filtro/preferência que muda a view (período custom, densidade).
- **Criar / Novo [X]** = criação (Novo Lead, Nova tarefa, Novo Vendedor).

**Padrões de janela** — padronizar rótulos e posições:
- Fechar = **X** no canto superior direito (sempre).
- Cancelar (secundário à esquerda) × Confirmar/Salvar (primário à direita).
- Excluir = destrutivo (vermelho), sempre com confirmação.
- Voltar = seta/rótulo consistente (não misturar "Voltar" com "X").
- Editar/Novo = mesma posição e cor entre telas.

**Superfícies** — modal (TaskModal) vs sheet vs drawer (SituationDrawer) vs Portal (LeadDiary) coexistem;
convergir para 1 padrão de "editar em foco".

---

## Parte 7 — Telas que parecem "internas" (e por quê)

| Tela | Interno? | Por quê (específico) |
|---|:--:|---|
| **Tráfego** | 🔴 Muito | 100% placeholder; KPIs "—"; copy honesta de onboarding interno ("Conecte uma plataforma em Contas…"); sem demo/mock |
| **Remuneração** | 🔴 Muito | PIN por vendedor (segurança interna, não confiança de produto); 3 preocupações misturadas (equipe+templates+comissão); form sprawl |
| **Comercial** | 🟠 Médio | Jargão (Funil/Radar/Quente/Esfriando); drag sem dica; detalhe só em modal; hierarquia plana (sem "top deal") |
| **Financeiro** | 🟠 Médio | Muro de métricas sem narrativa; disclaimers em cinza pequeno explicando o próprio sistema ("client_payments") |
| **Clientes** | 🟠 Médio | Detalhe = schema cru (fuso, drive_folder_url); WhatsApp em 3 lugares "parafusados" |
| **Agente** | 🟠 Médio | Confirma "create_lead" (enum), não "Criar João da Silva?"; erros crus ("Faltou o nome") |
| **Configurações** | 🟡 Leve | Seções placeholder ("IA indisponível") passam sensação de inacabado |
| **Hall** | 🟢 Ok | Painel denso, mas coerente (após ajuste de ritmo) |
| **Perfil** | 🟢 Ok | Limpo após migração do DS |
| **Mapa** | 🟢 Produto | Showpiece — o que mais parece produto vendido |

---

## Parte 8 — Priorização

| # | Problema | Tela | Impacto | Esforço | Prioridade |
|---|---|---|:--:|:--:|:--:|
| 1 | Domínio 100% placeholder (0 dado, 15 KPIs "—", 11 rotas stub) vendido como feature | Tráfego | Alto | Alto | **Crítico** |
| 2 | Radar (fila do dia) escondido na 2ª aba; colunas colapsadas escondem 80% dos leads | Comercial | Alto | Médio | **Alto** |
| 3 | Confirmação do Agente mostra enum + erros crus; capacidades estáticas (não insights) | Agente | Alto | Baixo | **Alto** |
| 4 | 3 vocabulários de cor competindo no funil | Comercial | Médio | Médio | **Alto** |
| 5 | Financeiro passivo: 12 KPIs peso-igual, sem drill-down/CTA | Financeiro | Médio | Médio | **Médio** |
| 6 | Remuneração: salário 2×, nesting profundo, PIN por vendedor | Remuneração | Médio | Alto | **Médio** |
| 7 | Detalhe do Cliente = schema cru; WhatsApp em 3 lugares | Clientes | Médio | Médio | **Médio** |
| 8 | Hall empilha 5 abas — Tarefas (feature grande) enterrada como aba | Hall / IA | Médio | Alto | **Médio** |
| 9 | Configurações: 15+ seções, várias placeholder | Configurações | Médio | Médio | **Médio** |
| 10 | Verbos de botão inconsistentes (Salvar/Confirmar/Aplicar/Atualizar) | Global | Baixo | Baixo | **Médio** |
| 11 | Duplo CTA por card (onOpen + Abrir workspace) | Clientes | Baixo | Baixo | **Baixo** |
| 12 | Nav 3-way redundante (sidebar+quick-actions+breadcrumb) | Tráfego | Baixo | Baixo | **Baixo** |
| 13 | Gráfico 6 meses sempre visível mesmo com 2 meses de dado | Financeiro | Baixo | Baixo | **Baixo** |
| 14 | Timestamps em toda mensagem do Agente | Agente | Baixo | Baixo | **Baixo** |

---

## Parte 9 — Auto-review brutalmente honesto (US$ 399/mês)

**"Eu teria orgulho desta tela cobrando US$ 399/mês?"** — nota por tela (0–10):

| Tela | Nota | Veredito |
|---|:--:|---|
| Mapa | **9** | Orgulho. É o showpiece. |
| Hall › Visão Geral | 7 | Bom, mas denso; falta 1 herói. |
| Relatório | 7 | Denso porém honesto e fiel. |
| Perfil | 7 | Limpo, discreto. |
| Tarefas | 6.5 | Funciona; 3 caminhos de criação confundem. |
| Agente | 6.5 | UX de conversa ótima, mas "vaza" enums. |
| Comercial | 6 | Poderoso, mas power-user/interno. |
| Clientes | 6 | Prateleiras espertas; detalhe cru. |
| Financeiro | 5.5 | Muro de métricas sem narrativa. |
| Configurações | 5 | Depósito de settings com placeholders. |
| Remuneração | 5 | Profundo, aninhado, redundante. |
| **Tráfego** | **3** | Esqueleto v0.1 vendido como feature. |

- **Nota 10?** Nenhuma ainda. **Mapa (9)** é a mais perto.
- **Nota 5?** Configurações, Remuneração — e **Tráfego (3)** abaixo disso.
- **Mais precisa melhorar?** **Tráfego** (é o que mais destoa de "produto vendido").
- **Já excelente?** **Mapa.** É a prova de que o time consegue fazer nível produto — é o padrão a espalhar.

---

## Parte 10 — Implementação (represada)

Regra desta sprint: **implementar quase nada** — só se risco ~zero, ganho evidente, zero mudança funcional.
**Decisão: 0 alteração de código nesta sprint.** Motivos:
1. As melhorias reais são **estruturais** (redesenho de hierarquia/IA), não trocas de 1 classe — fora do
   "risco praticamente zero".
2. Não consigo ver os pixels renderizados; editar às cegas a aparência **arrisca piorar**. Prefiro documentar
   e deixar você aprovar visualmente.

### Melhorias rápidas prontas (aguardando seu OK — copy/apresentação, sem lógica)
- **Agente:** mapa de rótulos humanos na barra de confirmação ("Confirmar: criar lead **João da Silva**")
  em vez do enum. *(apresentação pura; um `Record<op,label>`)*
- **Financeiro:** trocar o disclaimer cinza por rótulos claros ("Recebido / Fechado") + microcopy 1 linha.
- **Botões:** padronizar o verbo por intenção (Parte 6) — só troca de texto.
- **Clientes:** remover um dos dois CTAs do card (manter "Abrir workspace"). *(verificar se o `onOpen` tem
  uso distinto antes — pode ser mudança de comportamento; por isso fica represado.)*
- **Tráfego (empty):** remover 2 das 3 repetições de "conecte contas" e reduzir 15 KPIs "—" para 4.

### Melhorias grandes (projeto — documentar e agendar)
- **Tráfego:** demo/mock data + onboarding que esconde Gestão/Medição/IA até 1 conta + 1 CTA herói.
- **Comercial:** Radar como default; colunas expandidas; top-3 próximas ações em destaque; **unificar os 3
  sistemas de cor em 1**.
- **Remuneração:** separar equipe / políticas / comissões; gate por papel (sem PIN por vendedor).
- **Hall / IA:** promover Tarefas para fora das abas do Hall (feature de primeira classe).
- **Financeiro:** narrativa ("entrou X · previsto Y · em risco Z") + drill-down nos números.
- **Global:** lembrar última escolha (período/filtro/aba); atalhos de teclado.

---

## Screenshots esperados (o que você deve ver)

- **Nenhuma mudança visual nesta entrega** — este documento é diagnóstico; nada foi implementado.
- Ao aplicar as "melhorias rápidas" (após seu OK): barra do Agente legível; Financeiro com rótulos claros;
  cards de Clientes com 1 CTA; Tráfego vazio mais enxuto. Todas visualmente equivalentes em layout/tokens.

---

## Riscos

- **Deste documento: zero** (não altera código). 
- **Das melhorias rápidas:** baixo (copy/apresentação) — mas exigem seu aval visual, por isso represadas.
- **Das melhorias grandes:** médio/alto — são redesenhos; entram como sprints próprias, uma a uma, com
  validação (tsc/lint/build) e sem tocar em regra/serviço/DS/token, conforme a diretriz.
