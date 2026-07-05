# Proposta — Clientes Históricos, Comissão Histórica, Pagamento Mensal e Upgrade

**Sprint:** PRODUCT-SPRINT-002
**Status:** PROPOSTA (nada aplicado no banco / dados / regras). Aguarda autorização para implementar em fases.
**Princípio-mestre:** reusar o **motor vivo date-driven** que já existe. **Nenhum segundo motor financeiro. Nenhuma arquitetura paralela.** Historicidade = **dado correto** (datas retroativas), não recálculo nem edição manual de comissão.

---

## 0. TL;DR (a descoberta que muda tudo)

O motor de comissão **já é histórico por natureza**: a competência de cada comissão é a **data do evento** (`weekly_payments.paid_on` para semanas, `meetings.met_on` para reuniões), lida como fatia `YYYY-MM` — e a comissão é **derivada ao vivo** a cada leitura (não existe tabela de ledger/snapshot congelado).

> **Consequência:** se um `weekly_payments` nasce com `paid_on = '2026-05-10'`, a comissão dele **cai em maio** automaticamente — em Minha Remuneração, relatórios, PDF e fechamento. Sem recálculo, sem edição manual.

Logo, "cliente histórico" e "comissão histórica" **não exigem motor novo**. Exigem **poder gravar as datas certas** (hoje o sistema trava a entrada em "hoje") e **rodar o backfill que já existe** (`payDueWeeks`). O trabalho é de **cadastro + dados**, não de cálculo.

Evidências: `src/lib/commission/calc.ts:13` (`inMonth` = `dateStr.slice(0,7)`), `:54-60` (semanas por `paidOn`, reuniões por `metOn`); `src/server/services/MyCompensationService.ts:124-125`; escrita `src/lib/commission/actions.ts:129-156` (`payClientWeek`) → `:104-124` (`deriveCommission`); backfill `:173-198` (`payDueWeeks`).

---

## 1. Diagnóstico — o que já existe e funciona (não recriar)

| Peça | Onde | Comportamento |
|---|---|---|
| **Competência** | `lib/commission/calc.ts:13,54-60` | comissão bucketed por `paid_on` (semanas) e `met_on` (reuniões), fatia `YYYY-MM` |
| **Comissão derivada ao vivo** | idem | **sem** `commission_ledger`/`snapshots`; recalcula na leitura; câmbio congelado por linha (`cotacao_usd_brl`) mantém BRL histórico estável |
| **Dois ledgers** | `actions.ts:129-156, 104-124` | `client_payments` (cobrança, valor do **plano**, tem `anulado`) + `weekly_payments` (comissão, valor do **deal**). `payClientWeek` insere 1 `client_payment` e **deriva** 1 `weekly_payment` |
| **Estorno** | migration `048` (RPC `void_client_week`) | soft-delete atômico de `client_payments` + delete do `weekly_payments` |
| **Backfill de semanas** | `actions.ts:173-198` (`payDueWeeks`) | marca semanas vencidas com `paid_on = data de vencimento` (`dueDateFor(start, dia, n)`), parando quando `due > today` |
| **Data de entrada** | tudo | já é `clients.start_date` ("dias como cliente" `ClientResumo.tsx:42`, agenda de cobrança `ClientFinanceService.ts:48`) |
| **Datas semânticas** | timeline/relatórios/radar | `received_at`/`met_on`/`data_fechamento`/`paid_on`/`stage_changed_at`; `created_at` só como **fallback seguro** |
| **Config de comissão de upgrade** | `collaborator_compensation_settings.upgrade_commission_*` | **já existe** (enabled/type/value/base) |
| **Engine de upgrade** | `core/compensation/engine.ts:33-36` + `catalog.ts` (`closer-upgrade` 20%/4sem) | **já consome** `upgradeDelta`; evento `upgrade.completed` **tipado** |

---

## 2. Causa raiz — por que cliente antigo quebra hoje

O motor está certo; o **cadastro** é que aprisiona a data:

1. **`start_date` travado em "hoje"** — não está na allowlist de escrita (`src/app/(dashboard)/clientes/client-write-actions.ts:19`), **não há campo** em `ClienteModal.tsx`, e o fluxo "lead ganho" grava `start_date = hoje` (`leadActions.ts:83`).
2. **Sem UI para datas de pipeline** (lead / 1º contato / reunião / proposta / fechamento / virou cliente / 1º pagamento).
3. **Sem backfill no cadastro** — mesmo com `payDueWeeks` pronto, nada o dispara ao registrar um cliente antigo.

Resultado: cliente de maio nasce "hoje" → timeline, receita, dias como cliente, semanas, comissão e relatórios **todos deslocados para julho**. Exatamente o sintoma do Valdemir.

**Não há upgrade em lugar nenhum:** a config e o engine existem, mas **falta o evento/tabela** que dispare — `upgradeDelta` nunca é preenchido, `upgrade.completed` nunca é emitido, não há `plan_changes`.

---

## 3. Arquitetura escolhida (reuso-primeiro)

### 3.1 Cliente histórico (Partes 2, 3, 10)

**Regra:** ao cadastrar um cliente antigo, **reconstruir com linhas reais** nas tabelas que já existem, com **datas retroativas** — assim timeline/radar/relatórios/comissão funcionam pelo caminho normal, sem novo read-path.

- **Entrada:** liberar `start_date` (= "virou cliente") e `deals.data_fechamento` (= "fechamento") para datas **passadas** no cadastro/edição.
- **Pipeline:** reconstruir as etapas nas fontes reais + timeline:
  - `leads.received_at` = data do lead; `meetings.met_on` = data da reunião; `deals.data_fechamento` = fechamento.
  - "1º contato" e "proposta" (sem tabela dedicada) → `lead_interactions` com timestamp histórico (a timeline já lê essa tabela).
- **Backfill automático:** ao salvar o cliente histórico, rodar o **`payDueWeeks` existente** com `maxWeeks` suficiente. Como ele usa `dueDateFor(start, dia, n)`, todas as semanas de `start_date` até hoje nascem com `paid_on` **na data de vencimento histórica** → receita, semanas pagas, dias como cliente **e comissão** reconstruídos pelo motor vivo. **Zero escrita manual de comissão.**
- **Forma de cobrança:** já existe `dia_pagamento_semana`; a historicidade a respeita.

**Trade-off documentado (linhas reais vs colunas novas):** preferimos **reconstruir linhas reais** (lead/meeting/deal/payments) a adicionar colunas `lead_date/first_contact_at/...` em `clients`, porque (a) a timeline/radar/relatórios já leem as fontes reais — nada de novo read-path; (b) evita duplicar a verdade em dois lugares. Colunas de pipeline em `clients` ficam como **opção B** (mais simples de gravar, porém cria leitura nova e risco de divergência) — **não recomendada**.

### 3.2 Comissão histórica (Parte 4)

**É consequência direta da 3.1** — nenhum código de cálculo muda. Como a competência é `paid_on`/`met_on` e tudo é derivado ao vivo:

- semanas de maio → comissão em **maio**; reuniões de maio → em maio; e assim por diante.
- **ledger, snapshots, remuneração, histórico, relatórios, PDF, Minha Remuneração** respeitam automaticamente (todos leem o mesmo motor).
- **Não** existe edição manual de comissão — cadastra-se o histórico do cliente e a comissão nasce sozinha na competência certa.

⚠️ **Verificar antes do backfill (dado):** o deal do Valdemir tem `valor_por_semana_usd = 28` enquanto o plano Start é `140/sem`. Confirmar se `28` é intencional (ex.: base de comissão = 20% de 140) — o backfill reproduz **o que o deal disser**.

### 3.3 Formas de pagamento: semanal **e** mensal (Partes 5, 6, 7)

- **`plans`** (hoje só `valor_semanal`): adicionar `valor_mensal numeric` + `periodicidade_default text check in ('semanal','mensal')`. Migration **aditiva**.
- **`clients`**: `periodicidade text` (herda do plano, override por cliente) + `dia_cobranca smallint` (para mensal; semanal continua em `dia_pagamento_semana`).
- **Pagamento mensal = 1 registro que quita as N semanas do período.** Novo helper `payMonth(clientId, competencia, paidOn)` que:
  1. resolve as `numero_semana` que compõem aquele mês (4 ou 5 conforme o calendário/`dia_cobranca`);
  2. chama o **mesmo `payClientWeek`** por semana (reuso total) → gera `client_payments` + `weekly_payments` com `paid_on` correto → **comissão por semana na competência certa**;
  3. valor = `plano.valor_mensal` (ou `N × valor_semanal`).
- **Sem 2º motor:** `payMonth` é um orquestrador fino sobre `payClientWeek`/`deriveCommission`. Semanas continuam sendo a unidade; "mensal" é só a **forma de registrar**.

### 3.4 Upgrade (Parte 8)

- **Nova tabela `plan_changes`** (evento que falta): `id, client_id, seller_id, old_plan_id, new_plan_id, old_valor_semanal, new_valor_semanal, delta_usd, changed_at date, team_id, created_at`. Migration + RLS **team-scoped**.
- **`deriveUpgradeCommission(planChange)`**: insere **um** registro de comissão (`weekly_payments` sintético do deal) com `valor = delta × taxa(upgrade_commission)` e **`paid_on = changed_at`** → cai na competência do mês do upgrade. O engine (`upgrade_percent`) já está pronto — só faltava a fonte. **Só o delta** (ex.: Start 560 → Growth 1000 ⇒ base 440), **sem duplicar** a comissão recorrente.
- **Efeitos colaterais:** atualiza o plano/deal do cliente para o novo valor a partir de `changed_at`; registra em `plan_changes` + `lead_interactions` (timeline). Aparece em Workspace, Comissão, Minha Remuneração, PDF e Relatórios pelos caminhos já existentes.

---

## 4. `created_at` — correções pontuais (auditoria, Parte 11)

A auditoria completa (2 varreduras independentes) concluiu: **o modelo de datas é sólido**; `created_at` é usado como **fallback seguro** ou trilha de auditoria em quase todo lugar. Correções reais:

| Local | Hoje | Correção | Severidade |
|---|---|---|---|
| `src/server/repositories/CommercialMetricsRepository.ts:30` | `clients.select('id, created_at')` p/ "clientes novos no período" | usar **`start_date`** (data de virada), com `created_at` só fallback | **corrigir** |
| `CommercialMetricsRepository.ts:28` | `meetings.select('id, valor_usd, created_at')` | confirmar bucket; se agrupa receita/contagem por mês, usar **`met_on`** | verificar |
| Demais (`received_at ?? created_at`, `met_on ?? created_at`, `data_fechamento ?? created_at`, `HallClient` list sort) | fallback/tiebreak | **manter** (correto) | ok |

Nenhuma outra comissão/relatório/dashboard/timeline usa data errada.

---

## 5. Migrations propostas (aditivas, reversíveis) — **NÃO aplicadas**

Todas aditivas; nenhuma toca RLS existente. Leitura de remuneração continua **own-or-admin** (migration 047); writes seguem **team-scoped** (carimbar `team_id`).

- **049 — `plans`:** `add column valor_mensal numeric`, `add column periodicidade_default text default 'semanal' check (...)`.
- **050 — `clients`:** `add column periodicidade text`, `add column dia_cobranca smallint`. (Opção B, se adotada: colunas de pipeline — **não recomendada**.)
- **051 — `plan_changes`** (upgrade): tabela + índices (`client_id`, `changed_at`) + RLS team-scoped.
- (Sem migration para "cliente histórico": ele **reusa** `start_date`/`data_fechamento`/`payDueWeeks` — só código de cadastro.)

---

## 6. Plano de implementação em fases (cada uma com autorização, sem push)

1. **F1 — Cliente & comissão histórica:** liberar `start_date`/`data_fechamento` retroativos (cadastro + edição + allowlist), campos de pipeline no `ClienteModal`, reconstrução de linhas reais + backfill via `payDueWeeks`. Corrigir `CommercialMetricsRepository` (`created_at`→`start_date`). *(Sem migration.)*
2. **F2 — Semanal + mensal:** migration 049/050 + cadastro de plano (valor semanal/mensal, periodicidade, 1º pagamento, dia de cobrança) + `payMonth`.
3. **F3 — Upgrade:** migration 051 (`plan_changes`) + `deriveUpgradeCommission` + UI de upgrade (data, plano antigo/novo, delta) + timeline.
4. **F4 — Valdemir (dado real):** só após F1 (e F2 se mensal). Script idempotente revisável.

Cada fase: `tsc --noEmit` + `lint` + `build` zero-warning, validação, **commit atômico**, **sem push**.

---

## 7. Valdemir — especificação exata (Parte 10)

**Estado atual (real, hoje):** cliente `e32776a6` `start_date=2026-07-05` (errado), plano Start `bb14133e` (140/sem), **1** semana em cada ledger (paga hoje), deal `abe48024` `data_fechamento=2026-07-05` `valor_por_semana=28`.

**Alvo:** fechamento **05/05/2026**, plano **Start**, cobrança **semanal**, história completa desde maio.

**Correção (após F1), como script idempotente revisável:**
1. `clients.start_date = '2026-05-05'`; `deals.data_fechamento = '2026-05-05'` (mesmo deal/`id`, sem recriar — respeita TEAM-001).
2. Remover a 1 semana espúria paga hoje (via RPC `void_client_week`) para não duplicar.
3. Rodar `payDueWeeks(clientId, rate, maxWeeks≈12)` → gera ~8–9 semanas de 05/05 até hoje, cada `paid_on` no vencimento histórico → receita, semanas, dias como cliente, timeline e **comissão em maio/junho/julho** reconstruídos pelo motor vivo.
4. Conferir `valor_por_semana=28` do deal (ver §3.2) antes de rodar.

**Nunca** aplicar sem autorização — é dado financeiro real de produção.

---

## 8. Parte 9 — Operação vs Administração de Clientes (análise crítica)

**Pergunta:** "Clientes" deve virar dois andares — *Operação* e *Administração*?

**Recomendação: NÃO criar dois andares no topo.** Fragmentar o módulo no rail global (a) contraria a regra de **≤2 níveis de navegação** recém-estabelecida (CLIENT-SHELL-001), (b) divide permissões e a fonte única de navegação, (c) força o usuário a decidir "onde está o cliente" antes de abrir o cliente.

**O que realmente existem são dois eixos** (e o produto já os separa):

1. **Gestão da carteira** (a lista/portfólio): onboarding, saúde, churn, MRR, cobrança em atraso — visão de **quem administra o negócio**.
2. **Workspace do cliente** (operar *aquele* cliente): as 12 seções, já agrupadas em 4 grupos em `buildClientConfig`.

**Proposta profissional (a mais limpa):** manter **um** andar "Clientes" e expressar a separação **dentro** dele, sem novo módulo:

- **Nível carteira:** a página lista ganha uma visão "Administração da carteira" (KPIs de MRR/churn/atraso/cohort) ao lado da operação (entregas/tarefas). É a "administração de clientes" que você intuiu — mas como **visão**, não como andar.
- **Nível workspace:** agrupar as abas em **"Operação"** (Tráfego, Projetos, Arquivos, Agenda, Relatórios) e **"Administração"** (Financeiro, Contrato/Cobrança, Comissão, Auditoria), **gated por permissão** — quem opera tráfego vê Operação; quem administra vê Financeiro/Comissão. Os grupos já existem no config; falta o rótulo Operação/Administração + o gate por papel.

**Resumo:** a separação certa é por **visão + permissão**, não por andar. Ganha-se a clareza que você quer **sem** quebrar navegação, permissões ou a fonte única. Se no futuro a carteira crescer muito, o passo seguinte é uma aba "Carteira" dentro de Clientes (não um módulo novo).

---

## 9. Garantias (o que esta proposta preserva)

- **Um único motor** — tudo reusa `payClientWeek`/`deriveCommission`/`payDueWeeks` e o cálculo vivo de `calc.ts`. Nada recalcula nem congela.
- **Sem quebra de regra** — RLS financeiro own-or-admin (047) e writes team-scoped intactos; estorno via RPC 048.
- **ARCH-001 / TEAM-001** — escrita só via server actions/serviços, `team_id` carimbado, deal do Valdemir **editado** (nunca recriado).
- **Aditivo** — migrations só adicionam colunas/tabela; `category`/enums crescem sem remover.
