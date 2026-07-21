-- COMPANY-PROFILE-001: cadastro institucional por workspace, editável apenas pelo owner.
alter table public.teams
  add column if not exists legal_name text,
  add column if not exists tax_id text,
  add column if not exists industry text,
  add column if not exists description text,
  add column if not exists motto text,
  add column if not exists mission text,
  add column if not exists vision text,
  add column if not exists company_values text[] not null default '{}'::text[],
  add column if not exists website text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'Brasil',
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists currency text not null default 'USD',
  add column if not exists locale text not null default 'pt-BR',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create or replace function public.user_is_team_owner(p_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team and tm.user_id = auth.uid()
      and tm.role = 'owner' and t.owner_id = auth.uid()
  )
$$;
revoke all on function public.user_is_team_owner(uuid) from public, anon;
grant execute on function public.user_is_team_owner(uuid) to authenticated;

drop policy if exists teams_update on public.teams;
drop policy if exists teams_update_owner_only on public.teams;
create policy teams_update_owner_only on public.teams for update to authenticated
  using (public.user_is_team_owner(id)) with check (public.user_is_team_owner(id));

-- Bloqueia updates diretos (inclusive de owner_id). A edição permitida passa pelo RPC fechado abaixo.
revoke update on table public.teams from authenticated;

create or replace function public.update_team_company_profile(
  p_team_id uuid, p_name text, p_legal_name text, p_tax_id text, p_industry text,
  p_description text, p_motto text, p_mission text, p_vision text, p_company_values text[],
  p_website text, p_contact_email text, p_contact_phone text, p_address_line text,
  p_city text, p_state text, p_postal_code text, p_country text, p_timezone text,
  p_currency text, p_locale text
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_team public.teams;
begin
  if auth.uid() is null or not public.user_is_team_owner(p_team_id) then
    raise exception 'Somente o owner pode alterar os dados da empresa.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'O nome da empresa deve ter ao menos 2 caracteres.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_company_values, 1), 0) > 20 then
    raise exception 'Informe no máximo 20 valores da empresa.' using errcode = '22023';
  end if;
  if upper(trim(coalesce(p_currency, ''))) not in ('USD', 'BRL', 'EUR') then
    raise exception 'Moeda inválida.' using errcode = '22023';
  end if;
  if trim(coalesce(p_locale, '')) not in ('pt-BR', 'en-US', 'es-ES') then
    raise exception 'Idioma inválido.' using errcode = '22023';
  end if;
  if trim(coalesce(p_timezone, '')) not in ('America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles') then
    raise exception 'Fuso horário inválido.' using errcode = '22023';
  end if;

  update public.teams set
    name = left(trim(p_name), 120),
    legal_name = nullif(left(trim(coalesce(p_legal_name, '')), 180), ''),
    tax_id = nullif(left(trim(coalesce(p_tax_id, '')), 40), ''),
    industry = nullif(left(trim(coalesce(p_industry, '')), 100), ''),
    description = nullif(left(trim(coalesce(p_description, '')), 1200), ''),
    motto = nullif(left(trim(coalesce(p_motto, '')), 240), ''),
    mission = nullif(left(trim(coalesce(p_mission, '')), 800), ''),
    vision = nullif(left(trim(coalesce(p_vision, '')), 800), ''),
    company_values = coalesce((select array_agg(left(trim(v), 100)) from unnest(coalesce(p_company_values, '{}'::text[])) v where trim(v) <> ''), '{}'::text[]),
    website = nullif(left(trim(coalesce(p_website, '')), 300), ''),
    contact_email = nullif(left(trim(coalesce(p_contact_email, '')), 254), ''),
    contact_phone = nullif(left(trim(coalesce(p_contact_phone, '')), 40), ''),
    address_line = nullif(left(trim(coalesce(p_address_line, '')), 240), ''),
    city = nullif(left(trim(coalesce(p_city, '')), 100), ''),
    state = nullif(left(trim(coalesce(p_state, '')), 100), ''),
    postal_code = nullif(left(trim(coalesce(p_postal_code, '')), 24), ''),
    country = left(trim(coalesce(nullif(p_country, ''), 'Brasil')), 100),
    timezone = left(trim(coalesce(nullif(p_timezone, ''), 'America/Sao_Paulo')), 80),
    currency = upper(left(trim(coalesce(nullif(p_currency, ''), 'USD')), 3)),
    locale = left(trim(coalesce(nullif(p_locale, ''), 'pt-BR')), 20),
    updated_at = now(), updated_by = auth.uid()
  where id = p_team_id returning * into v_team;

  if v_team.id is null then raise exception 'Empresa não encontrada.' using errcode = 'P0002'; end if;
  return to_jsonb(v_team);
end
$$;

revoke all on function public.update_team_company_profile(uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_team_company_profile(uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text) to authenticated;
