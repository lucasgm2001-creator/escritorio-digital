# Remuneracao por Cargo e Tipo

## Visao do modulo

O modulo de remuneracao do Escritorio Digital v2 deve evoluir para regras configuraveis por cargo, tipo de vendedor e assignment especifico de vendedor. A DR Growth M. e apenas a primeira equipe usando o produto; o modelo precisa funcionar para qualquer equipe no SaaS multi-tenant.

Owner e Admin configuram as regras. Vendedores comuns nao veem a regra completa de remuneracao; eles veem apenas vendas, reunioes, valores a receber e historico de pagamentos.

Historico antigo nao deve ser recalculado quando uma regra mudar. Toda nova regra deve valer apenas para eventos futuros ou para eventos a partir de uma vigencia explicita.

## Conceitos

### Cargo

Cargo e a funcao operacional do colaborador dentro da equipe, como Closer, SDR, Manager, Admin ou um cargo customizado. O cargo ajuda a organizar pessoas e sugerir regras padrao, mas nao deve ser usado sozinho como fonte final de calculo.

### Tipo de vendedor

Tipo de vendedor representa o comportamento de remuneracao esperado para aquele papel comercial. Exemplos:

- `closer`: fecha contratos e recebe comissao sobre venda.
- `sdr`: gera reunioes e pode receber comissao por reuniao.
- `manager`: pode ter regra propria futura.
- `admin`: pode administrar, sem necessariamente receber comissao.
- `custom`: regra especifica da equipe.

### Regra de remuneracao

Regra de remuneracao define salario fixo, comissao de venda, comissao de reuniao, bonus de renovacao, comissao de upgrade, limite de semanas e regra de pagamento. Ela deve possuir vigencia com `effective_from` e, quando substituida, `effective_until`.

### Assignment do vendedor

Assignment vincula um vendedor a uma regra de remuneracao em uma equipe e em uma vigencia. Um vendedor pode trocar de regra no futuro sem apagar a regra anterior.

### Ledger e snapshot de comissao

Ledger e o historico imutavel dos valores calculados. Cada evento de comissao deve guardar snapshot da regra usada no momento do calculo, como percentual, valor fixo, limite de semanas, plano, diferenca de upgrade e cotacao.

O relatorio deve ler o ledger/snapshot, nao recalcular com base na regra atual.

## Regra atual do Lucas

Hoje o unico vendedor e Lucas. Lucas deve ser considerado Closer.

Gabriel nao e SDR. Gabriel nao deve ser associado a nenhuma regra de remuneracao de venda nesta etapa.

Regra Lucas/Closer:

- Fixo mensal: US$ 200.
- Comissao de venda: 20% do valor do plano.
- Pagamento: conforme o cliente paga.
- Limite: 4 semanas por contrato.
- Comissao de reuniao: desabilitada.
- Bonus de renovacao: US$ 50 a cada 3 meses.
- Upgrade: 20% da diferenca do plano, dividido em ate 4 semanas.

Exemplo de venda:

- Cliente fecha plano de US$ 140 por semana.
- Comissao semanal: US$ 140 x 20% = US$ 28.
- Limite: 4 semanas.
- Total maximo da comissao do contrato: US$ 112.
- Se o cliente pagar 2 semanas no mes atual, entram US$ 56 na folha correspondente.
- Se pagar mais 2 semanas no mes seguinte, entram US$ 56 na folha seguinte.

Exemplo de upgrade:

- Cliente sai de US$ 140 para US$ 190 por semana.
- Diferenca: US$ 50 por semana.
- Comissao: US$ 50 x 20% = US$ 10 por semana.
- Limite: ate 4 semanas.
- Pagamento: conforme o cliente paga.

Exemplo de renovacao:

- Bonus: US$ 50 a cada 3 meses quando houver renovacao valida.
- A regra exata de evento de renovacao deve ser modelada antes da implementacao.

## SDR

SDR deve ser registrado apenas como modelo futuro.

Nao associar Gabriel como SDR. Nao criar assignment para Gabriel.

Modelo futuro de SDR:

- Salario fixo: configuravel.
- Comissao por reuniao: US$ 15.
- Comissao por venda: ainda indefinida.
- Bonus de renovacao: desabilitado por padrao.
- Comissao de upgrade: desabilitada por padrao.

## Modelo de dados proposto

### compensation_roles

Tabela de cargos/tipos configuraveis por equipe.

Campos sugeridos:

- `id`
- `team_id`
- `name`
- `role_type`: `closer`, `sdr`, `manager`, `admin`, `custom`
- `description`
- `created_at`
- `updated_at`

### compensation_rules

Tabela de regras de remuneracao com vigencia.

Campos sugeridos:

- `id`
- `team_id`
- `role_id`
- `name`
- `fixed_salary_enabled`
- `fixed_salary_amount`
- `sale_commission_enabled`
- `sale_commission_type`: `percentage` ou `fixed`
- `sale_commission_value`
- `sale_commission_cap_weeks`
- `payment_rule`: inicialmente `weekly_as_client_pays`
- `meeting_commission_enabled`
- `meeting_commission_value`
- `renewal_bonus_enabled`
- `renewal_bonus_amount`
- `renewal_bonus_interval_months`
- `upgrade_commission_enabled`
- `upgrade_commission_type`
- `upgrade_commission_value`
- `upgrade_commission_base`: inicialmente `plan_difference`
- `effective_from`
- `effective_until`
- `created_at`
- `updated_at`

### seller_compensation_assignments

Tabela que associa vendedor a uma regra.

Campos sugeridos:

- `id`
- `team_id`
- `seller_id`
- `compensation_rule_id`
- `effective_from`
- `effective_until`
- `created_at`
- `updated_at`

### commission_events

Tabela futura para ledger imutavel de comissao calculada.

Campos sugeridos:

- `id`
- `team_id`
- `seller_id`
- `client_id`
- `deal_id`
- `source_type`: `sale_week`, `meeting`, `renewal_bonus`, `upgrade_week`, `manual_adjustment`
- `source_id`
- `amount_usd`
- `amount_brl`
- `currency_rate`
- `paid_on`
- `competence_month`
- `rule_snapshot`
- `created_at`

## Tabelas reaproveitadas

- `sellers`: cadastro operacional do vendedor/colaborador.
- `plans`: catalogo de planos e valor semanal.
- `clients`: cliente, plano atual e responsavel.
- `deals`: venda/contrato fechado.
- `client_payments`: verdade de quando o cliente pagou.
- `weekly_payments`: ledger legado de comissao semanal.
- `meetings`: reunioes realizadas.

## Legado

Os itens abaixo devem ser tratados como legado ou ponte de transicao:

- `sellers.default_commission`: nao deve ser fonte oficial futura.
- `sellers.fixed_salary`: nao deve ser fonte oficial futura.
- `seller_salaries`: pode preservar historico atual, mas a nova regra deve viver em `compensation_rules`.
- `plans.comissao_percentual`: pode ser mantido como compatibilidade/snapshot legado, mas a fonte oficial futura deve ser a regra de remuneracao.
- `CommissionSection` configurando regra: deve deixar de configurar salario, regra de venda e cotacao diretamente. A configuracao deve migrar para Administracao / Equipe / Remuneracao.

## Fluxo de configuracao

1. Owner/Admin acessa Administracao / Equipe / Remuneracao.
2. Cria ou edita cargos/tipos de remuneracao.
3. Configura uma regra com vigencia.
4. Associa vendedores a regras.
5. Ao mudar uma regra, encerra a vigencia anterior e cria uma nova.
6. Vendedor comum nao acessa essa configuracao.

## Fluxo de calculo futuro

1. Um evento financeiro acontece: venda, pagamento de semana, reuniao, renovacao ou upgrade.
2. `CommissionService` identifica equipe, vendedor, cliente e evento.
3. Busca a regra ativa do vendedor na data do evento.
4. Calcula o valor conforme a regra.
5. Grava snapshot imutavel no ledger.
6. Relatorios e dashboards leem o ledger.

## Preservacao de historico

Regras novas nao podem recalcular comissoes antigas.

Eventos ja pagos ou calculados devem manter:

- valor em USD;
- valor em BRL, quando aplicavel;
- cotacao usada;
- regra ou percentual usado;
- plano ou diferenca de upgrade;
- data de competencia;
- data de pagamento.

## Ordem futura de implementacao

1. Criar migration aditiva para `compensation_roles`, `compensation_rules` e `seller_compensation_assignments`.
2. Criar seed idempotente da regra Closer de Lucas.
3. Evoluir `CompensationRepository` com writes seguros.
4. Evoluir `CompensationService` com permissoes, activeTeamId e vigencia.
5. Criar UI admin em Administracao / Equipe / Remuneracao.
6. Aplicar calculo novo apenas para eventos futuros.
7. Criar `commission_events` como ledger imutavel.
8. Migrar leitura de dashboards para ledger.
9. Remover configuracoes financeiras da `CommissionSection`.
10. Endurecer RLS por `team_id` e permissao.

## Regras de seguranca

- Apenas Owner/Admin configuram regras.
- Vendedor comum nao ve regras.
- Nenhuma regra deve usar fallback global.
- Toda regra deve ter `team_id`.
- Toda escrita deve passar por Service server-side.
- Toda migration deve ser aditiva e idempotente.
- Dados reais nao podem ser apagados, recriados ou recalculados sem decisao explicita.
