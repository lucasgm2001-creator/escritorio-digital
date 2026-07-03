# Saída de equipe & sucessão de owner (TEAM-SECURITY-001)

Como funciona hoje, e a proposta de endurecimento atômico.

## Regras (implementadas no servidor)

Local: `src/server/services/TeamService.ts` (`leaveActiveTeam`, `pickSuccessor`) + as Server Actions em
`src/app/(dashboard)/configuracoes/team-actions.ts` (`switchTeamAction`, `leaveTeamAction`).

- **Trocar equipe** — valida no servidor que o usuário pertence à equipe alvo (via `context.memberships`) e
  só então grava o cookie `edv2_active_team_id`. Nunca confia no id vindo da UI.
- **Sair — não-owner** (member/admin): remove apenas a própria linha de `team_members`.
- **Sair — owner com outros membros**: promove um sucessor a owner **antes** de remover o owner atual.
- **Sair — owner único** (nenhum outro membro): **bloqueado** com mensagem clara.

### Hierarquia de sucessão

`owner` mais antigo → `admin` mais antigo → `member` mais antigo.

> O schema (`039_team_schema_reconciliation.sql`) define `role` como `owner | admin | member`. **Não existe
> `manager`** — por isso esse nível da hierarquia pedida não se aplica.

**Critério de "mais antigo":** `team_members.created_at` ascendente (a coluna existe). Empate ou `created_at`
nulo → desempate estável por `id`.

## Segurança

- Toda a lógica roda no servidor (Server Action → Service). A UI só dispara e mostra o resultado.
- Validações: sessão ativa, pertencimento à equipe (revalidado pelo banco), owner único bloqueado, sucessor
  válido, nunca deixar a equipe sem owner.
- **Escritas via service role** (`createServiceClient`): o RLS de `team_members` (`team_members_admin_manage`)
  só permite que **admins** apaguem/alterem linhas — um `member` não conseguiria nem remover a própria
  membership. Como não podemos alterar RLS nesta sprint, as escritas usam service role **após** a validação
  completa no servidor. Não há alteração de policies/tabelas/migrations.

## Atomicidade — risco conhecido e proposta

O client JS do Supabase não abre transação multi-statement. A sucessão do owner são 3 escritas:

1. `update team_members set role='owner'` no sucessor;
2. `update teams set owner_id=<sucessor>`;
3. `delete from team_members` do owner que sai.

A **ordem** é à prova de falha: o novo owner é definido **antes** de remover o antigo. Se algo falhar no meio,
o pior caso é a equipe ficar com **2 owners** (recuperável) — **nunca 0**. Nenhum dado da equipe é apagado.

### Proposta (NÃO aplicada): RPC atômica `leave_team`

Para atomicidade total, mover as 3 escritas para uma função `SECURITY DEFINER` (mesmo padrão de `create_team`
/ `redeem_invite`, migrations `041`). **Isto é só uma proposta — não foi aplicada ao banco.**

```sql
-- PROPOSTA — revisar e aplicar como migration própria (ex.: 044_leave_team.sql). NÃO aplicado.
create or replace function public.leave_team()
returns table (promoted uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_team  uuid;
  v_role  text;
  v_succ  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select tm.team_id, tm.role into v_team, v_role
  from public.team_members tm
  where tm.user_id = v_uid
  order by tm.created_at nulls last
  limit 1;  -- (na app, a equipe ATIVA vem do cookie; aqui simplificado)

  if v_team is null then raise exception 'not a member'; end if;

  if v_role <> 'owner' then
    delete from public.team_members where team_id = v_team and user_id = v_uid;
    return;
  end if;

  -- sucessor: owner > admin > member, mais antigo primeiro
  select tm.user_id into v_succ
  from public.team_members tm
  where tm.team_id = v_team and tm.user_id <> v_uid
  order by case tm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
           tm.created_at nulls last, tm.id
  limit 1;

  if v_succ is null then
    raise exception 'sole owner: invite or promote someone before leaving';
  end if;

  -- tudo numa transação (função) → atômico
  update public.team_members set role = 'owner' where team_id = v_team and user_id = v_succ;
  update public.teams set owner_id = v_succ where id = v_team;
  delete from public.team_members where team_id = v_team and user_id = v_uid;

  promoted := v_succ;
  return next;
end;
$$;
```

Quando/if aplicada, `leaveActiveTeam` passaria a chamar `supabase.rpc('leave_team')` e dispensaria o service
role para esta operação. Até lá, a implementação por service role com ordem à prova de falha é segura.
