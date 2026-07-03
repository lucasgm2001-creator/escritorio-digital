# ORG-COMP-001 — Colaboradores & Remuneração em Administração (plano)

Documento de planejamento (PRJ-001). Registra o que já foi feito, o que fica **preparado/honesto** e a **migration proposta** (NÃO aplicada) para as fases que exigem persistência. Não altera regra financeira, não recalcula histórico.

## Estado após esta sprint

- **B1 — feito.** "Equipe e Comissões" saiu do Comercial. `VendedoresTab` foi **realocada** para `/admin/remuneracao` (owner/admin, gate do `/admin`). Comercial = Funil/Contatos/Métricas + Novo Lead. Mesma Compensation atual; nada apagado/recalculado.
- **Fundação existente (honesta, "Prévia"):** `/admin/colaboradores` (lista + `[id]` perfil) via `PeopleService`+`PeopleRepository` (**seed em memória** — departamentos, cargos closer/sdr/gestor, colaboradores exemplo). `/admin/remuneracao` via `CompensationEngineService` (templates read-only) + agora a `VendedoresTab` real. `src/core/compensation` (engine/catalog/types). **Nada disso é persistido ainda.**

## B2/B3 — Colaboradores reais + perfil (próximo passo, sem migration)

Hoje a lista mostra colaboradores **de exemplo** (seed). Integração proposta (reusa o que já existe, sem banco novo):
- `PeopleService.listCollaboratorCards` passa a compor os **membros reais** (`TeamService.getActiveTeamMembers` → nome/email/papel owner/admin/member + iniciais) e cruzar com cargo/departamento/template do catálogo quando houver vínculo.
- `/admin/colaboradores/[id]` resolve por `user_id` real (perfil do **Lucas** e do Gabriel aparecem pela lista; hoje o acesso ao perfil do Lucas é via Team Admin/`/perfil`).
- Perfil profissional (B3): nome, email, avatar/iniciais, cargo/função, **papel (owner/admin/member)**, status, entrada, área, remuneração (template + override), permissões, ações. **Reusa** as ações de Team Admin (promover/rebaixar/transferir/remover) — não duplica.

## B4 — Catálogo de funções prontas (modelado)

Cargos oferecidos ao criar/configurar colaborador. Cada um: nome · descrição · área · nível · permissões sugeridas · remuneração sugerida · participa de comissão · tipo de meta.

| Função | Área | Nível | Comissão? | Remuneração sugerida (resumo) |
|---|---|---|---|---|
| SDR | Comercial | Jr/Pl | sim | fixo + bônus reunião marcada/comparecida + bônus venda originada + teto + acelerador |
| Closer | Comercial | Pl/Sr | sim | fixo + % da venda + comissão semanal (parcelada) + comissão por plano + renovação + upgrade + teto + acelerador |
| Gestor de Tráfego | Tráfego | Pl/Sr | sim | fixo + bônus cliente ativo + bônus performance + bônus retenção + meta ROAS/leads |
| Gerente Comercial | Comercial | Sr | sim | fixo + bônus por equipe + % sobre vendas do time + meta mensal + bônus por batimento |
| Administrativo | Administrativo | — | não (padrão) | fixo |
| Financeiro | Financeiro | — | não (padrão) | fixo + bônus operacional (se existir) |
| Operações | Operações | — | opcional | fixo |
| Atendimento | Atendimento | — | opcional | fixo (+ bônus opcional) |
| Owner | Direção | — | conforme regra | livre |
| Admin | Direção | — | conforme regra | livre |

`Closer`/`SDR` já têm template no `catalog.ts`; os demais entram como blueprint de catálogo (seed) + template quando configurados.

## B5 — Remuneração avançada por função

Deve usar a **Compensation Engine existente** (`src/core/compensation/engine.ts` — `CompensationRule[]` por template). **Não** criar cálculo paralelo nem 2ª engine. As regras acima viram `CompensationRule` (tipo/base/percentual/teto/acelerador/gatilho por evento). A UI de configuração por função edita o `TemplateBlueprint` do cargo. Enquanto não houver persistência: preview via `getPreview` (já existe) + estados honestos.

## B6 — Override individual por colaborador

Regra: **template por função = padrão; configuração individual = override** (exceção). No perfil: ver template aplicado · editar exceções (fixo/percentual/bônus/teto) · observações · status da regra. Ex.: Closer padrão 20% · Lucas 25% (override) · Gabriel fixo+bônus (override) · Thamyris fixo administrativo (cargo). **Histórico nunca recalcula** — override vale a partir da vigência; lançamentos passados ficam congelados (mesma disciplina do `seller_salaries.effective_from` e da cotação travada de hoje).

## B7 — /admin/remuneracao como centro de configuração

Seções: **templates por função** · regras disponíveis · **preview** de cálculo · colaboradores vinculados · **exceções individuais** · status. Estados honestos (nunca "Em breve"): "Não configurado", "Sem override individual", "Usando template padrão", "Requer configuração", "Prévia de cálculo", "Histórico não recalculado".

## B8 — Arquitetura (ARCH-001)

UI → Server Actions → Services (`PeopleService`/`CompensationEngineService`) → Repositories (`PeopleRepository`/`CompensationTemplateRepository`/`CompensationRepository`) → Supabase/catálogo. Reusar Workspace Center/Team Admin/MetricCard/Panel/WorkspaceHeader/EmptyState. **Sem cálculo financeiro no client. Sem 2ª engine. Sem duplicar a Comissão do Comercial** (a `VendedoresTab` real continua a fonte da comissão de vendas atual).

## B9 — Segurança

Só **owner/admin** configuram remuneração; **member** sem acesso de edição. Validação **no servidor** em toda action (`requirePermission`/checagem de `context.role`), nunca só botão escondido. Owner pode tudo; admin gerencia colaboradores; member leitura/nenhum.

## B10 — Migration PROPOSTA (NÃO aplicada)

Para persistir templates por função + overrides individuais (hoje tudo é seed em memória). **Requer autorização antes de aplicar.** Esboço team-scoped, alinhado ao padrão de RLS `team_scope` + trigger `set_team_id_default`:

```sql
-- Templates de remuneração por função (1 por cargo/versão).
create table public.compensation_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  role_key text not null,               -- 'closer' | 'sdr' | 'gestor_trafego' | ...
  name text not null,
  currency text not null default 'USD',
  rules jsonb not null default '[]',     -- CompensationRule[] (mesma forma da engine)
  version int not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Override individual (exceção por colaborador; template = padrão).
create table public.compensation_overrides (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  user_id uuid not null,                 -- colaborador (profiles/team_members)
  base_template_id uuid references public.compensation_templates(id),
  fixed_override numeric,                -- sobrescreve fixo
  percent_override numeric,              -- sobrescreve %
  bonus_rules jsonb default '[]',
  cap_override numeric,                  -- teto individual
  notes text,
  status text not null default 'active',
  effective_from date not null default current_date,   -- vigência: NÃO recalcula histórico
  created_at timestamptz default now(),
  unique (team_id, user_id, effective_from)
);

-- RLS: espelhar team_scope (using/with check team_id in (select user_team_ids()));
-- writes gated a admin/owner por user_is_team_admin(team_id). Trigger set_team_id_default aplica.
```

**Impacto:** aditivo (2 tabelas novas), sem tocar `sellers`/`deals`/`weekly_payments`/`seller_salaries` (a comissão de vendas atual segue intacta). A engine lê template+override e calcula (nunca recalcula lançamentos passados).

## Resumo do que fica preparado (honesto) nesta sprint

- Feito e vivo: Part A (overlays sólidos) + B1 (tab realocada; config real em Administração).
- Preparado/documentado (precisa de migration ⇒ autorização): B2/B3 integração real de colaboradores, B4 catálogo completo, B5 regras avançadas na engine, B6 overrides individuais, B7 centro de configuração. UI/actions serão construídas sobre a fundação já existente, sem 2ª engine e sem recalcular histórico.
