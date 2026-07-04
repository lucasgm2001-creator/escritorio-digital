# Colaboradores (cargo/departamento/gestor) + Remuneração — migration + reaproveitamento

**IDs:** PERSONAL-WORK-001 (Parts 9–13) · COLLABORATORS-REAL-001 (Parts 4–6, 9)
**Status:** **Fase 1 APLICADA** (extensão de `team_members`, migration 044). **Fase 2 (remuneração) REAPROVEITA infra existente — sem tabelas novas.**
**Princípios:** ARCH-001, TEAM-001, reaproveitar `team_members`/`profiles`/`collaborator_compensation_settings`/
`CompensationRepository`/`lib/commission`/Event Bus — **sem arquitetura paralela**, **sem recalcular histórico**.

> ⚠️ **Auto-review (COLLAB Part 10):** a 1ª versão desta proposta sugeria tabelas `compensation_templates` +
> `compensation_assignments`. Ao auditar `supabase/migrations/`, descobri que **a persistência de remuneração
> por colaborador JÁ EXISTE** (`collaborator_compensation_settings`, migration 040, efetivo-datada, lida pelo
> `CompensationRepository`) e que o modelo por cargo/tipo já está desenhado em
> `docs/04-banco-de-dados/remuneracao-por-cargo-e-tipo.md`. Aquelas tabelas eram **duplicação** → **removidas**.

---

## 0. Auditoria — o que já existe

| Necessidade | Já existe? | Ação |
|---|---|---|
| Ownership de **tarefa/agenda** | ✅ `tasks`/`calendar_events` com `user_id`+`team_id` | Nenhuma (só faltava filtrar `team_id`, feito) |
| **Reuniões comerciais** | ✅ `meetings` (entidade separada) | Não mexer |
| **Cargo/Departamento/Gestor/Entrada/Status** por equipe | ❌ (só `profiles.cargo` texto global) | **Fase 1 — aplicada** (`team_members`) |
| **Remuneração por colaborador** (fixo, comissão, reunião, renovação, upgrade, regra de pagamento, vigência) | ✅ **`collaborator_compensation_settings`** (migration 040) + `CompensationRepository` | **Reusar** — nada novo |
| **Histórico imutável / snapshot** | ✅ ledger de comissão + efetivo-datação (design oficial) | Reusar |
| **Regra por CARGO/tipo (template)** | 🟡 desenhado em `remuneracao-por-cargo-e-tipo.md`; hoje é por seller | Evoluir sobre o existente (fora deste escopo) |

O catálogo de cargos/departamentos é **código** (`lib/people/catalog.ts`, 35 cargos) — não vai ao banco.

---

## 1. Fase 1 — `team_members` estendida (✅ APLICADA, migration 044)

Cargo/depto/gestor são **por equipe** → em `team_members` (1:1 com a associação), não em `profiles` (global).

```sql
alter table public.team_members
  add column if not exists role_key        text,   -- chave do cargo (ROLE_CATALOG.key); null = não configurado
  add column if not exists department_key  text,   -- chave do depto (DEPARTMENT_CATALOG.key)
  add column if not exists manager_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists joined_at       date,   -- entrada (backfill: created_at::date)
  add column if not exists status          text not null default 'ativo'
    check (status in ('ativo','inativo','afastado','convidado'));
create index if not exists idx_team_members_role    on public.team_members(team_id, role_key);
create index if not exists idx_team_members_manager on public.team_members(manager_user_id);
```

- Aditivo/retrocompatível; herda a RLS de `team_members`.
- `role_key`/`department_key` validados na aplicação contra o catálogo (não FK).
- **Backfill feito:** `joined_at = created_at::date` (todos); `status = 'ativo'` (todos); **Lucas → `closer`/`comercial`**
  (alinha com `remuneracao-por-cargo-e-tipo.md`: "Lucas = Closer"); **Gabriel → não configurado** (idem: "Gabriel não
  associado a regra nesta etapa"). Nenhum delete.

---

## 2. Remuneração — REUSAR `collaborator_compensation_settings` (nada novo)

A remuneração por colaborador **já é persistida e efetivo-datada**:

- Tabela **`collaborator_compensation_settings`** (migration 040): `seller_id`, `fixed_salary_*`,
  `contract_commission_*`, `meeting_commission_*`, `renewal_bonus_*`, `upgrade_commission_*`, `payment_rule`,
  `effective_from`, `unique(seller_id, effective_from)`.
- **`CompensationRepository`** (ARCH-001: DAL só leitura; regras no Service) já lê essa tabela.
- **Override individual** = uma nova linha por `seller_id` com nova `effective_from` (o passado nunca muda).
- **Histórico não recalcula** = ledger/snapshot de comissão (design oficial em `remuneracao-por-cargo-e-tipo.md`).

**Modelo por CARGO (template):** o cargo (`team_members.role_key`) **sugere** os defaults (via `defaultComp`/
`commission` do catálogo) ao criar a config do colaborador — o cargo **não** é a fonte final de cálculo (a config
por colaborador é). Uma tabela de "regra por cargo" reutilizável é a evolução já prevista naquele doc; quando
for construída, será **sobre** `collaborator_compensation_settings`, não uma tabela paralela. **Nada a criar agora.**

⚠️ Tabela órfã encontrada: **`seller_comp_config`** existe no banco mas **nenhum código a usa** (o vivo é
`collaborator_compensation_settings`). Sugiro tratá-la numa limpeza futura (confirmar e `DROP` com autorização) —
não faz parte desta entrega.

---

## 3. Impacto / Camadas / Eventos

- Aditivo e retrocompatível. Sem remoção/rename. Sem recálculo de histórico.
- **ARCH-001**: UI → Server Actions gated (`can(context,'teams','manage')`) → `PeopleService`/`CompensationService`
  → Repositories (`CompensationRepository`) → DB. Escrita em membro de outro usuário via service-role + guarda de
  ownership (TEAM-ADMIN-001).
- **Event Bus**: `employee.role.changed` / `.department.changed` / `.manager.changed` / `.compensation.changed` /
  `.hired` / `.archived` já no catálogo (só contrato).

---

## 4. Próximos passos (com seu aval)

1. **Wire de leitura** — `PeopleService` passa a ler `team_members.role_key/department_key/manager/status` →
   Colaboradores mostra o cargo REAL do Lucas (Closer) e Gabriel "não configurado" (honesto). *Sem migration.*
2. **UI de atribuição de cargo** — owner/admin escolhe cargo do catálogo → grava `team_members.role_key` por action
   gated. *Sem migration.*
3. **Remuneração** — UI de config sobre `collaborator_compensation_settings` (já existe a tabela + repo).
4. **Limpeza** — avaliar `DROP TABLE seller_comp_config` (órfã), com autorização.
