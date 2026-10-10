-- ACOMPANHANDO (MESA-FOCO-001): lista manual de leads que a pessoa quer manter no radar.
--
-- Problema que resolve: depois de falar com um lead, ele voltava para o meio de 113 atrasados e se
-- perdia. Não havia nenhum lugar onde "os que estou trabalhando" ficassem juntos.
--
-- Por que uma tabela nova em vez de reusar colunas existentes: `prioridade` está preenchida nos 302 leads
-- (alta/media/baixa/urgente, atribuída automaticamente) e `temperature` é avaliação do lead — nenhuma das
-- duas significa "eu escolhi vigiar este". Reaproveitar qualquer uma faria a aba nascer com centenas de
-- itens, que é exatamente o problema que ela existe para resolver.
--
-- POR USUÁRIO, não por equipe: "os leads que EU estou trabalhando". Dois vendedores no mesmo time têm
-- radares diferentes sobre a mesma carteira.

create table if not exists public.lead_focus (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  nota text,
  created_at timestamptz not null default now()
);

-- Um lead aparece no radar de alguém UMA vez. O upsert da UI depende disto.
create unique index if not exists lead_focus_user_lead_uk on public.lead_focus (user_id, lead_id);
create index if not exists lead_focus_user_idx on public.lead_focus (user_id, team_id);

alter table public.lead_focus enable row level security;

drop policy if exists lead_focus_select on public.lead_focus;
create policy lead_focus_select on public.lead_focus for select
  using (user_id = auth.uid() and team_id in (select public.user_team_ids()));

drop policy if exists lead_focus_insert on public.lead_focus;
create policy lead_focus_insert on public.lead_focus for insert
  with check (user_id = auth.uid() and team_id in (select public.user_team_ids()));

drop policy if exists lead_focus_update on public.lead_focus;
create policy lead_focus_update on public.lead_focus for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists lead_focus_delete on public.lead_focus;
create policy lead_focus_delete on public.lead_focus for delete
  using (user_id = auth.uid());
