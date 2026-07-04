# Proposta de migration — Colaboradores (cargo/departamento/gestor) + Remuneração (templates + override)

**IDs:** PERSONAL-WORK-001 (Parts 9–13) · COLLABORATORS-REAL-001 (Parts 4–6, 9)
**Status:** PROPOSTA — **nada aplicado.** Aguarda autorização explícita para rodar.
**Princípios:** ARCH-001 (UI→Services→Repos→DB), TEAM-001 (tudo escopado por `team_id`), reaproveitar
`team_members`/`profiles`/`lib/commission`/Event Bus — **sem arquitetura paralela**, **sem recalcular histórico**.

---

## 0. O que a auditoria concluiu (por que esta migration)

| Necessidade | Já existe? | Ação |
|---|---|---|
| Ownership de **tarefa** | ✅ `tasks.user_id` + `tasks.team_id` | **Nenhuma** — já pessoal (só faltava filtrar `team_id`, já feito) |
| Ownership de **agenda** | ✅ `calendar_events.user_id` + `team_id` | **Nenhuma** — idem |
| **Reuniões comerciais** | ✅ `meetings` (seller_id/client_id/lead_id) | **Não mexer** — entidade separada |
| **Cargo** do colaborador | ⚠️ `profiles.cargo` (texto livre, global) | Migrar p/ estruturado **por equipe** |
| **Departamento** | ❌ | Criar campo (por equipe) |
| **Gestor** (líder direto) | ⚠️ `profiles.is_manager` (bool) | Criar vínculo `manager_user_id` |
| **Template de remuneração** por cargo | ❌ | Nova tabela |
| **Remuneração individual / override** | ❌ | Nova tabela (efetivo-datada) |
| **Metas** | ❌ (catálogo tem `goalType` padrão) | Campo no template/assignment |

Catálogo de cargos/departamentos já é **código** (`lib/people/catalog.ts`, 35 cargos) — **não vai ao banco**.
O banco guarda só o **vínculo** colaborador↔cargo e a remuneração real.

---

## 1. Tabela existente a ESTENDER — `team_members` (fatos de RH por equipe)

Cargo/depto/gestor são **por equipe** (a mesma pessoa pode ter papéis diferentes em equipes diferentes) →
pertencem a `team_members` (1:1 com a associação), não a `profiles` (global).

```sql
-- PROPOSTA (não aplicado)
alter table public.team_members
  add column role_key         text,                       -- chave do cargo (ROLE_CATALOG.key); null = não configurado
  add column department_key   text,                       -- chave do depto (DEPARTMENT_CATALOG.key); derivável do cargo
  add column manager_user_id  uuid references public.profiles(id) on delete set null,
  add column joined_at        date,                       -- data de entrada (fallback: created_at::date)
  add column status           text not null default 'ativo'  -- ativo | inativo | afastado | convidado
    check (status in ('ativo','inativo','afastado','convidado'));

create index if not exists idx_team_members_role   on public.team_members(team_id, role_key);
create index if not exists idx_team_members_manager on public.team_members(manager_user_id);
```

- `role_key`/`department_key` são **texto validado na aplicação** contra o catálogo (não FK — o catálogo é código).
- Nenhuma coluna nova é obrigatória → **linhas atuais seguem válidas** (defaults/nullable).

---

## 2. Tabela nova — `compensation_templates` (o "modelo" por cargo)

```sql
-- PROPOSTA (não aplicado)
create table public.compensation_templates (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  role_key       text,                                    -- cargo sugerido (ROLE_CATALOG.key) ou null (avulso)
  name           text not null,                           -- ex.: "Closer DR Growth"
  base_salary    numeric(12,2) not null default 0,        -- fixo
  commission_pct numeric(6,3),                            -- % sobre venda (ex.: 20.000)
  commission_fixed numeric(12,2),                         -- comissão fixa por venda
  bonus          jsonb not null default '[]',             -- [{label, trigger, amount}] — bônus/premiação/metas
  recurrence     text not null default 'mensal'           -- mensal | por_venda | pontual
    check (recurrence in ('mensal','por_venda','pontual')),
  goal_type      text,                                    -- reunioes|vendas|time|performance|retencao|entregas|nenhuma
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_comp_templates_team on public.compensation_templates(team_id, role_key);
```

---

## 3. Tabela nova — `compensation_assignments` (colaborador → template + OVERRIDE, efetivo-datado)

O **override individual** e a **vigência** vivem aqui. Efetivo-datado = **histórico nunca recalcula** (Part 6):
uma venda paga sob a regra vigente na época permanece; regra nova só vale para vendas futuras.

```sql
-- PROPOSTA (não aplicado)
create table public.compensation_assignments (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  template_id    uuid references public.compensation_templates(id) on delete set null,
  -- OVERRIDE individual (null = herda do template). Mesmos campos do template.
  base_salary    numeric(12,2),
  commission_pct numeric(6,3),
  commission_fixed numeric(12,2),
  bonus          jsonb,
  goal_type      text,
  notes          text,
  effective_from date not null default current_date,      -- vigência (nunca reescreve o passado)
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index idx_comp_assign_user on public.compensation_assignments(team_id, user_id, effective_from desc);
```

A remuneração **efetiva** = `coalesce(override, template, catálogo)` na data — resolvida no Service
(reaproveitando `lib/commission` para o cálculo; **sem segunda engine**).

---

## 4. RLS (mesmo modelo já usado no projeto)

```sql
-- PROPOSTA (não aplicado). Padrão: SELECT p/ membros da equipe; escrita só owner/admin.
alter table public.compensation_templates   enable row level security;
alter table public.compensation_assignments enable row level security;

-- Leitura: membro da equipe. (remuneração é sensível — pode-se restringir a owner/admin + o próprio; decidir na aplicação)
create policy comp_tpl_read on public.compensation_templates for select
  using (exists (select 1 from public.team_members tm where tm.team_id = compensation_templates.team_id and tm.user_id = auth.uid()));

-- Escrita: só owner/admin da equipe.
create policy comp_tpl_write on public.compensation_templates for all
  using (exists (select 1 from public.team_members tm where tm.team_id = compensation_templates.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')))
  with check (exists (select 1 from public.team_members tm where tm.team_id = compensation_templates.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')));
-- (policies equivalentes para compensation_assignments)
```

As colunas novas de `team_members` herdam a RLS já existente da tabela — sem policy nova.

---

## 5. Impacto

- **Aditivo e retrocompatível.** Nenhuma coluna/tabela existente é removida ou renomeada. Linhas atuais seguem válidas.
- **Sem recálculo de histórico** — comissões/pagamentos já registrados não mudam (efetivo-datação).
- **Reaproveita**: `team_members` (vínculo), `profiles` (identidade), `lib/people/catalog` (cargos/deptos),
  `lib/commission` (cálculo), Event Bus (`employee.role.changed`/`.department.changed`/`.compensation.changed`/
  `.manager.changed`/`.hired`/`.archived` — já no catálogo).
- **Camadas (ARCH-001)**: UI → Server Actions gated (`can(context,'teams','manage')`) → `PeopleService`/novo
  `CompensationService` → Repositories → DB. Escrita em membro de outro usuário via service-role + guarda de
  ownership (TEAM-ADMIN-001).

---

## 6. Plano de backfill (só após aplicar a migration)

1. `team_members.joined_at := created_at::date` (todos).
2. `team_members.status := 'ativo'` (todos os membros atuais).
3. `team_members.role_key` — mapear manualmente do `profiles.cargo` atual:
   - **Lucas** (`profiles.cargo = 'SDR/Closer'`, owner) → `role_key = 'closer'` (ou 'owner'; decidir) — 1 linha.
   - **Gabriel** (`cargo = null`) → deixar `null` (honesto: "não configurado") ou `'gestor_trafego'` se confirmado.
4. **Remuneração**: **nenhum** backfill — começa vazio (estado honesto "não configurado"). Sem inventar valores.

Contagem atual: **2 membros** (Lucas owner, Gabriel member) na equipe DR Growth. Nenhum delete, em nenhuma etapa.

---

## 7. O que NÃO muda

- Tarefas e agenda: **já** têm `user_id`+`team_id` — sem migration.
- `meetings` (reuniões comerciais): intocado.
- `profiles.cargo`: mantido (compat); a fonte estruturada passa a ser `team_members.role_key`. Podemos depreciar
  `profiles.cargo` depois, sem pressa.
- Nenhuma engine de comissão nova; nenhum histórico recalculado.

---

## 8. Decisão pendente (para você)

- [ ] Autorizar aplicar a migration (seções 1–4)?
- [ ] `role_key` do Lucas: `closer`, `sdr` ou `owner`?
- [ ] Leitura de remuneração: visível a todo membro da equipe **ou** só owner/admin + o próprio?

Nada roda sem esse aval.
