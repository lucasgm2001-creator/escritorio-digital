# SMART-WORKFLOW-001 — De "conjunto de telas" para "produto que trabalha junto"

> Objetivo: **reduzir cliques, reduzir decisões, aumentar a inteligência do fluxo** — sem redesign, sem
> refatoração, sem trocar o visual. Escopo: só fluxo/UX. **Nada** de banco, SQL, métrica, permissão, service,
> repository, server action, integração, design system ou responsividade foi alterado.
> Parte 8: implementei **apenas** o que é client-only e sem lógica/regra/API. Todo o resto está documentado.
> Data: 06/07/2026.

---

## Parte 1 — Percurso dos fluxos principais (contagem de fricção)

Contagem aproximada do caminho **Lead → Contato → Reunião → Proposta → Cliente → Financeiro → Remuneração →
Histórico → Relatório** (o histórico é automático no save — bom). "Decisões" = escolhas que o usuário precisa
fazer manualmente.

| Etapa | Cliques | Modais | Decisões | Telas | Desperdício |
|---|:--:|:--:|:--:|:--:|---|
| Novo lead | ~2 | 1 (LeadModal) | ~6 (nome, empresa, telefone, responsável, nicho, origem…) | 1 | Responsável poderia sugerir "eu"; nicho/origem poderiam ter default |
| Registrar contato | 2–3 | 0–1 (LeadDiary) | 2 (qual botão + resultado) | 1 | Atendeu/Mensagem/Não Atendeu existe no card **e** no LeadDiary (duplicado) |
| → Reunião | 1 (arrastar) ou 2 (expandir → Mover para) | 0 | 1 | 1 | Arrastar é escondido; sem dica |
| → Proposta | 1–2 | 0 | 1 | 1 | idem |
| → Cliente (ganhou) | 1 + WonPlanModal | 1 | ~2 (plano, valor) | 1 | ok |
| Ver Financeiro | 2–3 (sidebar → Admin → Financeiro) | 0 | 1 (período) | +1 troca de contexto | Sai do Comercial p/ Admin |
| Ver Remuneração | 2–3 + **PIN por vendedor** | 1 (PIN) | 1 | +1 troca | PIN a cada vendedor; período de novo |
| Histórico | 0 (automático) | 0 | 0 | 0 | ✅ bom |
| Relatório | 1–2 (Hall → aba Relatório) | 0 | 1 (período) | +1 | Período re-escolhido a cada visita |

**Padrões de desperdício encontrados:**
1. **Troca de contexto** entre Comercial ↔ Admin/Financeiro ↔ Admin/Remuneração para um mesmo ciclo.
2. **Período re-escolhido** em cada tela (Relatório, Financeiro, Comercial) — nunca lembrado.
3. **Ações duplicadas** (registrar contato no card e no LeadDiary; abrir cliente por 2 caminhos).
4. **Decisões que o sistema poderia tomar** (responsável = eu; ordenação = prioridade; aba = a última).
5. **Modais para tudo** (LeadDiary, LeadModal, WonPlanModal, PIN) — cada um é uma troca de foco.

---

## Parte 2 — Ações que podem ser automáticas (lembrar / pré-selecionar / abrir)

| Oportunidade | Onde | Ganho |
|---|---|---|
| **Lembrar período** | Relatório · Financeiro · Comercial | −1 decisão por visita ✅ *(implementado no Relatório)* |
| **Lembrar responsável (filtro)** | Tarefas · Comercial | −1 clique por sessão ✅ *(implementado em Tarefas)* |
| **Lembrar última aba** | Hall · Comercial | abre onde o usuário estava |
| **Sugerir responsável = eu** | Novo lead / nova tarefa | −1 decisão na criação |
| **Abrir último lead/cliente** | Comercial / Clientes | retomar de onde parou |
| **Pré-selecionar filtros** | Radar/Funil (fila do dia) | menos setup |
| **Default de nicho/origem** | LeadModal | menos campos obrigatórios |

Todos são **client-only** (localStorage), padrão já usado no app (`uiPrefs`, `a11y`, `hallSettings`,
`mapPrefs`). Risco baixo com fallback seguro.

---

## Parte 3 — Onde o sistema pode ORIENTAR (em vez de esperar clique)  ·  *documentar (sem IA)*

Frases derivadas de dados que **já existem** nos componentes (nenhuma métrica/serviço novo):

- Hall › Prioridades: **"Você tem 3 reuniões hoje · 5 tarefas atrasadas."** (já há contagens; falta 1–2 além.)
- Comercial › topo: **"5 propostas sem retorno há 3+ dias."** (deriva de `situation`/`followup_state`.)
- Financeiro: **"2 clientes atrasados — ver."** (já calcula "clientes em atraso"; falta o link.)
- Remuneração/Hall: **"Lucas lidera as vendas desta semana."** (deriva de `receitaPorVendedor`.)
- Tarefas/Radar: **"Daniel tem 4 leads sem resposta."** (deriva do filtro por responsável.)

Onde faz sentido: **um cabeçalho de "o que exige ação agora"** no Hall e no Comercial (Radar). Regra de ouro:
a frase só aparece quando **muda o que o usuário faria**. Implementação = leitura dos dados já carregados +
1 linha de texto (sem IA, sem query nova) — mas envolve montar a frase a partir do estado, então **fica
documentado** para uma sprint dedicada (não é "trocar 1 classe").

---

## Parte 4 — Decisões desnecessárias (o sistema poderia decidir)

| Decisão hoje | Poderia ser | Como |
|---|---|---|
| **Período** | Última escolha / "esta semana" | lembrar (feito no Relatório) |
| **Ordenação** | Por prioridade (atrasadas → hoje → próximas) | já é o default em Tarefas ✅; padronizar no Comercial |
| **Aba ativa** | A última usada | lembrar |
| **Responsável (criação)** | "Eu" por padrão | pré-selecionar o usuário logado |
| **Status/etapa** | Derivado da ação | mover ao registrar contato/reunião (parcial: Radar já deriva situação) |

---

## Parte 5 — Informação que não influencia decisão (candidata a sumir/on-demand)

Se um dado **nunca muda o que o usuário faz**, ele compete por atenção à toa:
- **Card do lead/cliente:** `fuso`, `area_code`, `drive_folder_url` — operacionais, raramente decisivos → detalhe.
- **Timestamps** em toda mensagem do Agente e em listas densas → on-hover.
- **Carteira (MRR/ARR)** dentro de telas de período → já separado no Relatório; aplicar no resto.
- **15 KPIs** de peso igual (Financeiro/Tráfego) → 1 herói + 3 apoios; resto sob demanda.
- **Micro-grid financeiro** em todo card de Cliente → só no detalhe.

---

## Parte 6 — Ações rápidas (sem trocar de tela)  ·  *maioria documentar (exigem server action)*

| Ação | Existe hoje? | Observação |
|---|---|---|
| **Concluir tarefa** | ✅ inline | já é 1 clique |
| **Abrir WhatsApp** | ✅ (telefone) | manter em lead/cliente/tarefa |
| **Copiar link de chamada** | ✅ inline (tarefa) | bom padrão |
| Responder / Registrar contato | parcial (LeadDiary) | trazer p/ o card/fila sem abrir modal |
| Agendar / Criar tarefa | modal | quick-add inline no lead |
| Marcar recebido / Registrar pagamento | tela própria | **server action → fora do escopo seguro** (documentar) |
| Enviar proposta | — | fluxo a desenhar |

Quase todas as que **faltam** dependem de **server action** (marcar recebido, registrar pagamento, criar
tarefa) — proibidas nesta sprint. Ficam documentadas como "ações rápidas fase 2".

---

## Parte 7 — Top 20 melhorias de UX (impacto × esforço × risco)

| # | Melhoria | Impacto | Esforço | Risco | Status |
|---|---|:--:|:--:|:--:|:--:|
| 1 | **Lembrar período** (Relatório/Financeiro/Comercial) | Alto | Baixo | Baixo | ✅ Relatório feito |
| 2 | **Lembrar responsável** (Tarefas/Comercial) | Alto | Baixo | Baixo | ✅ Tarefas feito |
| 3 | Radar como visão **default** do Comercial (fila do dia) | Alto | Médio | Médio | doc |
| 4 | Cabeçalho "o que exige ação agora" (guidance) no Hall/Comercial | Alto | Médio | Baixo | doc |
| 5 | Sugerir **responsável = eu** na criação | Alto | Baixo | Baixo | doc |
| 6 | Lembrar **última aba** (Hall/Comercial) | Médio | Baixo | Baixo | doc |
| 7 | Ordenação padrão por prioridade no Comercial | Médio | Baixo | Baixo | doc |
| 8 | Ações rápidas inline no card (responder/agendar) sem modal | Alto | Alto | Médio | doc |
| 9 | Colunas do funil **expandidas** por padrão (leads ativos) | Alto | Médio | Médio | doc |
| 10 | Link direto "clientes em atraso" no Financeiro | Médio | Baixo | Baixo | doc |
| 11 | Remover PIN por vendedor → gate por papel (Remuneração) | Alto | Alto | Médio | doc |
| 12 | Abrir **último lead/cliente** ao voltar | Médio | Baixo | Baixo | doc |
| 13 | Esconder campos operacionais do card (fuso/drive) → detalhe | Médio | Baixo | Baixo | doc |
| 14 | Quick-add de tarefa dentro do lead | Médio | Alto | Médio | doc (server action) |
| 15 | Marcar recebido / registrar pagamento inline | Alto | Alto | Alto | doc (server action) |
| 16 | Timestamps do Agente on-hover | Baixo | Baixo | Baixo | doc |
| 17 | Unificar "registrar contato" (card × LeadDiary) | Médio | Médio | Médio | doc |
| 18 | Lembrar último **chip** (Hoje/Próximas) no mobile de Tarefas | Baixo | Baixo | Baixo | doc |
| 19 | Atalhos de teclado (N novo, / buscar, G+H/G+C navegar) | Médio | Médio | Baixo | doc |
| 20 | "Continuar de onde parou" no topo do Hall | Médio | Médio | Baixo | doc |

---

## Parte 8 — Implementado (extremamente seguro) × documentado

### ✅ Implementado (client-only, sem lógica/regra/DB/métrica/API)
1. **Relatório — lembrar período.** `RelatorioComercial` inicia no último preset escolhido (localStorage,
   `ed:report-period`); valor ausente/inválido → `'semana'`. Custom não é lembrado. Componente é `ssr:false`,
   então ler localStorage no init é seguro (sem hydration mismatch).
2. **Tarefas — lembrar responsável.** `TarefasClient` inicia no último filtro (`ed:tasks-resp`), persiste na
   mudança e **descarta** um vendedor que não exista mais na lista (após carregar) → cai em `'todos'`. Só
   filtra tasks no cliente (nenhuma query/ação nova). `ssr:false` → init seguro.

Ambos usam o mesmo padrão de localStorage já presente no app (`uiPrefs`/`a11y`/`hallSettings`), com try/catch e
fallback. **Nenhum** service/repo/action/métrica tocado.

### 📝 Documentado (fica para sprints próprias — os 18 itens restantes do Top 20)
Os de maior impacto/menor risco para a próxima leva: **#5 sugerir responsável=eu**, **#6 lembrar última aba**,
**#10 link clientes em atraso**, **#4 guidance no Hall**. Os que exigem **server action** (#14, #15) ou
**redesenho de fluxo** (#3 Radar default, #11 sem PIN) são projetos maiores.

---

## Parte 9 — Auto-review

- **Quanto um vendedor economiza por dia?** Com o que já entrou (lembrar período + responsável): **~2–4 min/dia**
  de micro-fricção (parar de re-filtrar/re-selecionar a cada visita). Com o Top 20 completo (guidance, ações
  inline, Radar default): **~15–25 min/dia**.
- **Quanto um gestor economiza?** Hoje: **~2–3 min/dia** (período lembrado no Relatório). Com o roadmap
  (períodos lembrados em Financeiro/Remuneração, sem PIN por vendedor, links de drill-down): **~10–20 min/dia**.
- **O sistema parece mais inteligente?** Um pouco — ele agora **lembra** duas escolhas em vez de perguntar toda
  vez. O salto de "parece inteligente" vem da **guidance** (Parte 3) e das **ações rápidas** (Parte 6), ainda
  documentadas.
- **O usuário pensa menos?** Sim, marginalmente: **−1 decisão** por visita ao Relatório e **−1 clique** por
  sessão em Tarefas. O grosso do "pensar menos" está no roadmap (defaults inteligentes + fila do dia).

---

## Riscos
- **Das mudanças implementadas: baixo.** Só estado de UI no cliente (localStorage), com fallback seguro e
  guarda contra valor obsoleto; ambos os componentes são `ssr:false` (sem hydration mismatch). Nenhuma
  lógica/dado/ação/métrica alterada. tsc + lint + build verdes.
- **Do roadmap:** varia — os itens de server action (#14/#15) e de redesenho (#3/#11) entram como sprints
  próprias, com validação, sem tocar em regra/serviço/DS.
- **Ressalva honesta:** não vejo os pixels; validei estrutura, tipos e build. As contagens da Parte 1 são
  aproximadas (caminho típico), não medição instrumentada.

## Arquivos alterados
`src/app/(dashboard)/tarefas/RelatorioComercial.tsx` (lembrar período) ·
`src/app/(dashboard)/tarefas/TarefasClient.tsx` (lembrar responsável). Sem push.
