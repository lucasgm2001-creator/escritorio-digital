# Proposta — Próxima Sprint: Pagamento Mensal, Upgrade e Exclusão Lógica Global

**Continuação de** PRODUCT-SPRINT-002 (ver `docs/proposta-clientes-historicos-comissao.md`). F1 (cliente histórico) já entregou. Esta proposta detalha as 3 frentes seguintes.
**Status:** PROPOSTA — nada aplicado (banco/dados/regra). Aguarda autorização; migrations propostas antes de aplicar.
**Princípios (herdados):** reusar o motor date-driven; **sem 2º motor**; **sem duplicar arquitetura**; **regra financeira não muda sem explicação**; **sem push**; validar `tsc`/`lint`/`build`.

---

## Parte A — Pagamento Mensal (F2)

### Como é hoje
A unidade é a **semana** (`client_payments`/`weekly_payments`, competência por `paid_on`). Planos são **semanais** (`plans.valor_semanal`). `payDueWeeks` já marca N semanas de uma vez.

### O que muda (aditivo)
- **Migration 049 — `plans`:** `valor_mensal numeric NULL`, `periodicidade_default text CHECK IN ('semanal','mensal') DEFAULT 'semanal'`.
- **Migration 050 — `clients`:** `periodicidade text` (herda do plano; override por cliente), `dia_cobranca smallint` (dia do mês p/ mensal; semanal segue em `dia_pagamento_semana`).
- **`payMonth(clientId, mesRef, paidOn)`** — orquestrador FINO sobre o motor existente: resolve as `numero_semana` cujo vencimento cai no mês e chama **`payClientWeek` por semana** (reuso total). 1 pagamento mensal = N semanas marcadas + comissão derivada por semana, cada uma na competência do seu vencimento.
- **UI:** cadastro do plano (semanal/mensal + valores + 1º pagamento + dia); no `ClientPaymentsPanel`, botão "Registrar pagamento mensal".

### Regra financeira — **não muda** (explicação)
A comissão continua **por semana**, por `paid_on`. "Mensal" é apenas a **forma de registrar** (agrupa as semanas do período); não é uma nova unidade nem um novo cálculo. `payWeek`/`calc.ts` intactos. Valor mensal = `plano.valor_mensal` (ou `N × valor_semanal`), só afeta a receita agregada exibida — a comissão é a soma das semanas, idêntica ao fluxo semanal.

---

## Parte B — Upgrade (F3)

### O que já existe (não recriar)
Config `collaborator_compensation_settings.upgrade_commission_(enabled/type/value/base)` **e** o engine (`core/compensation/engine.ts:33-36`, regra `upgrade_percent`, catálogo `closer-upgrade` 20%/4sem) **já consomem** `upgradeDelta`. Falta só o **evento/fonte** (nunca é disparado; não há tabela).

### O que muda (aditivo)
- **Migration 051 — `plan_changes`:** `id, client_id, seller_id, old_plan_id, new_plan_id, old_valor_semanal, new_valor_semanal, delta_usd, changed_at date, team_id, created_at` + RLS team-scoped + índices (`client_id`, `changed_at`).
- **`deriveUpgradeCommission(planChange)`** — insere **um** registro de comissão (weekly_payment sintético do deal, ou linha dedicada) com `valor = delta_usd × taxa(upgrade_commission)` e **`paid_on = changed_at`** → competência do mês do upgrade. Reusa o motor (competência por data). **Só o delta.**
- Atualiza o plano/deal do cliente para o novo valor a partir de `changed_at` (novo `valor_por_semana`).
- **UI:** ação "Registrar upgrade" (data, plano antigo→novo, delta calculado). Aparece em Timeline, Comissão, Minha Remuneração, PDF, Relatórios pelos caminhos existentes.

### Regra financeira — **aditiva, explicada**
A comissão de upgrade é **um bônus único sobre o delta** (ex.: Start 560 → Growth 1000 ⇒ base **440**), **não** duplica a recorrente e **não** recalcula o passado. A taxa/base vêm da config já existente. É um novo **tipo de evento** ligado a um engine que já estava pronto — não um motor novo.

---

## Parte C — Exclusão Lógica Global (F4) — a frente nova e mais delicada

### Objetivo
Excluir **lead** ou **cliente** → ele **some de tudo**: comissão, relatórios, dashboards, radar, hall, timeline, PDFs, Minha Remuneração, qualquer métrica. **Sem apagar fisicamente.** Soft-delete **global**, fonte única, reversível e auditável.

### Estado atual (honesto)
- **Leads:** já existe um conceito de lixeira (`status='lixeira'`), filtrado em **alguns** surfaces (ex.: `RelatorioComercial.tsx:85`) — **inconsistente** (nem todo lugar filtra).
- **Clients:** `status ativo/inativo`. `inativo` = churn (**continua** no histórico/receita passada) — **não** é exclusão.
- **Não há `deleted_at`.** Há leituras via repositório (camada de serviço) **e** leituras diretas do browser (ex.: `HallClient`, `ClientPaymentsPanel`, `ConfiguracoesClient`).

### Arquitetura escolhida: `deleted_at` + cascade atômico + filtro em 3 camadas
1. **Coluna `deleted_at timestamptz` (+ `deleted_by uuid`, `deleted_reason text`)** nas entidades que alimentam métricas/comissão/timeline: `leads, clients, deals, weekly_payments, client_payments, meetings, lead_interactions, activities`. Índices **parciais** `WHERE deleted_at IS NULL` (performance).
2. **Cascade atômico via RPC SECURITY DEFINER** (mesmo padrão do `void_client_week`): `soft_delete_client(client_id)` carimba `deleted_at` no cliente **e** em deals/weekly_payments/client_payments/meetings/activities dele; `soft_delete_lead(lead_id)` idem para o lead + interactions + reunião/deal vinculados. **Reversível:** `restore_*` zera `deleted_at`. Team-guard + auditável.
3. **Filtro em 3 camadas (defense-in-depth, sem duplicar regra):**
   - **(a) Repositórios (choke-point ARCH-001):** `.is('deleted_at', null)` em cada leitura de serviço — `ClientRepository`, `LeadRepository`, `CommercialMetricsRepository`, loaders de Compensation/Timeline/LeadHub/Dashboard/Reporting/Radar/Hall. **Um** filtro por entidade.
   - **(b) RLS SELECT `deleted_at IS NULL`:** cobre as **leituras diretas do browser** (que não passam por repositório) e é rede de segurança para qualquer query que esqueça o filtro.
   - **(c) Crons/service-role:** o `auto-weeks` (service-role ignora RLS) filtra **explicitamente** `deleted_at IS NULL` (não gera receita/comissão para excluído).
4. **Lixeira/Restauração:** **uma** tela admin com query própria (o **único** lugar que vê excluídos) → restaurar / excluir definitivo. **Unifica** o `status='lixeira'` de leads migrando-o para `deleted_at` (não manter 2 conceitos de trash).

### Por que essa e não outra
| Alternativa | Problema |
|---|---|
| Só filtrar na UI | duplicação em toda tela → viola "não duplicar", fácil esquecer |
| Só RLS | crons/service-role vazam (ignoram RLS) |
| Views filtradas | refactor de todas as queries |
| **`deleted_at` + repos + RLS + cron** | **fonte única, cobre user+cron+browser, reversível, auditável, alinha ARCH-001** |

### Impacto financeiro — **regra não muda** (explicação)
Ao excluir um cliente, seus `weekly_payments` ganham `deleted_at` → o loader de comissão os **ignora** → some de Minha Remuneração/PDF/relatório **sem recalcular nada** (as linhas continuam no banco, com USD/cotação intactos; só saem do conjunto lido). **Restaurar** traz tudo de volta idêntico. Isso é **escopo de leitura**, não mudança de motor.

### Migrations propostas (aditivas) — não aplicadas
- **052** — `deleted_at/deleted_by/deleted_reason` nas 8 tabelas + índices parciais.
- **053** — RPCs `soft_delete_client` / `soft_delete_lead` / `restore_*` (SECURITY DEFINER, team-guard).
- **054** — RLS SELECT policies `+= deleted_at IS NULL` + filtro no cron.

### Fases da F4
- **F4a:** coluna + RPC cascade + filtro nos **repositórios** (comportamento correto via camada de serviço).
- **F4b:** RLS defense-in-depth + filtro do cron (cobre leituras diretas + service-role).
- **F4c:** tela **Lixeira** (restaurar / definitivo) + migração do `status='lixeira'` de leads para `deleted_at`.

---

## Ordem sugerida e riscos
1. **F2 (mensal)** → 2. **F3 (upgrade)** → 3. **F4 (exclusão)**. Cada uma: migração proposta → aprovação → implementação → `tsc`/`lint`/`build` → validação → commit atômico (sem push).
- **Maior risco:** F4 (superfície de leitura ampla). Mitigação: choke-point nos repositórios + RLS como rede + validação surface-a-surface (comissão, radar, hall, PDF, relatório, Minha Remuneração).

## Garantias
- **Migrations:** apenas **propostas** (não aplicadas).
- **Regra financeira:** não muda — mensal **agrupa** semanas; upgrade é **aditivo** sobre o delta; exclusão é **escopo de leitura**. Tudo explicado acima.
- **Sem motor novo. Sem duplicar arquitetura.** Reuso de `payClientWeek`/`deriveCommission`/`calc.ts`, do engine de upgrade já existente e do padrão RPC do `void_client_week`.
