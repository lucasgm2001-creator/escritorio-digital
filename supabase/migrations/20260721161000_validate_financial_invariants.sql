-- Validação pós-hardening: transforma as regras adicionadas como NOT VALID em garantias
-- integrais também para o histórico e impede regressão das policies legadas.

alter table public.client_payments validate constraint client_payments_valores_validos;
alter table public.client_payments validate constraint client_payments_status_amount_check;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename in ('client_payments','weekly_payments','deals','meetings','seller_salaries','plan_changes','plans','fx_config')
      and policyname in (
        'Auth gere client_payments','Auth le client_payments',
        'Auth lê seller_salaries','Auth insere seller_salaries','Auth atualiza seller_salaries','Auth deleta seller_salaries',
        'Auth lê deals','Auth insere deals','Auth atualiza deals','Auth deleta deals',
        'Auth lê weekly_payments','Auth insere weekly_payments','Auth atualiza weekly_payments','Auth deleta weekly_payments',
        'Auth lê meetings','Auth insere meetings','Auth atualiza meetings','Auth deleta meetings',
        'Auth le plans','Auth gere plans','Auth lê fx_config','Auth insere fx_config','Auth atualiza fx_config'
      )
  ) then raise exception 'policy financeira legada ainda ativa'; end if;

  if exists (
    select 1 from public.collaborator_compensation_settings cfg
    join public.sellers s on s.id=cfg.seller_id
    where not coalesce(s.gera_comissao,true)
      and (cfg.renewal_bonus_enabled or cfg.upgrade_commission_enabled)
  ) then raise exception 'colaborador sem comissao possui bonus ativo'; end if;
end;
$$;
