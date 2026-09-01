-- Bônus de renovação só é devido depois de 4 SEMANAS PAGAS a partir do 3º mês.
--
-- Regra antiga: chegou a data de anchor + 3 meses, o bônus de US$50 nascia na hora. Isso paga renovação
-- de um contrato que ainda não foi renovado de fato — o cliente pode simplesmente parar na semana
-- seguinte, e foi o que aconteceu com o Valdemir (bônus gerado, depois anulado à mão).
--
-- Regra nova: a renovação vira um FATO EM DUAS ETAPAS.
--   1) Chega a data dos 3 meses  → nasce a linha com status 'aguardando'. SEM deal, SEM comissão.
--      Serve para enxergar quem está no período de renovação.
--   2) O cliente paga 4 semanas COM VENCIMENTO A PARTIR da data de renovação → status 'confirmada' e
--      só então nascem o deal de bônus e a comissão de US$50.
--
-- Por que contar por VENCIMENTO >= renewal_date e não por número de semana: o número depende de quantas
-- semanas o contrato teve antes (upgrade, semana anulada, mês com 5 semanas) e mistura calendário com
-- contagem. "Quatro semanas devidas depois da data da renovação" é a tradução literal da regra e funciona
-- para a 1ª renovação e para todas as seguintes, sem aritmética de semanas.
--
-- Semana ANULADA não conta: só entra 'paga'.

begin;

-- 'aguardando' é o estado entre os 3 meses e a 4ª semana paga.
alter table public.contract_renewals drop constraint if exists contract_renewals_status_check;
alter table public.contract_renewals add constraint contract_renewals_status_check
  check (status in ('aguardando', 'confirmada', 'nao_renovou'));

create or replace function public.process_due_renewals(p_as_of date default current_date)
returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare r record; v_deal uuid; v_payment uuid; v_renewal uuid; v_rate numeric; v_count integer := 0;
begin
  select case when cotacao_travada and cotacao_manual is not null then cotacao_manual
              else coalesce(cotacao_referencia, cotacao_manual, 1) end
    into v_rate from public.fx_config where id = 1;
  v_rate := coalesce(v_rate, 1);

  -- ── ETAPA 1: abre a renovação como 'aguardando' quando chega a data dos 3 meses ──────────────
  for r in
    with first_paid as (
      select c.id client_id, c.name client_name, c.team_id, cp.paid_on anchor_date, c.end_date
      from public.clients c
      join public.client_payments cp on cp.client_id = c.id and cp.numero_semana = 1
       and cp.status = 'paga' and cp.paid_on is not null
      where c.status = 'ativo' and c.deleted_at is null
    ), due as (
      select f.*, gs renewal_number, (f.anchor_date + (gs * interval '3 months'))::date renewal_date
      from first_paid f cross join generate_series(1, 80) gs
      where (f.anchor_date + (gs * interval '3 months'))::date <= p_as_of
    )
    select d.*, s.id seller_id from due d
    join lateral (select 1) g on (d.end_date is null or d.end_date > d.renewal_date)
    join lateral (select h.assigned_to, h.assigned_name from public.client_assignment_history h
      where h.client_id = d.client_id and h.effective_from < (d.renewal_date + 1)::timestamp
      order by h.effective_from desc limit 1) a on true
    join lateral (select s0.id from public.sellers s0
      where s0.team_id = d.team_id and s0.status = 'ativo' and coalesce(s0.gera_comissao, true)
        and ((a.assigned_to is not null and s0.user_id = a.assigned_to)
          or (a.assigned_name is not null and lower(trim(s0.name)) = lower(trim(a.assigned_name))))
      order by case when a.assigned_to is not null and s0.user_id = a.assigned_to then 0 else 1 end,
               s0.created_at limit 1) s on true
    join lateral (select cfg.renewal_bonus_enabled from public.collaborator_compensation_settings cfg
      where cfg.seller_id = s.id and cfg.team_id = d.team_id and cfg.effective_from <= d.renewal_date
      order by cfg.effective_from desc limit 1) cfg on cfg.renewal_bonus_enabled = true
    where not exists (select 1 from public.contract_renewals cr
                      where cr.client_id = d.client_id and cr.renewal_number = d.renewal_number)
    order by d.renewal_date, d.client_id
  loop
    -- Nasce SEM deal e SEM comissão: nesta etapa a renovação ainda não foi paga.
    insert into public.contract_renewals(client_id, seller_id, renewal_number, anchor_date, renewal_date, bonus_usd, team_id, status)
    values (r.client_id, r.seller_id, r.renewal_number, r.anchor_date, r.renewal_date, 50, r.team_id, 'aguardando')
    on conflict (client_id, renewal_number) do nothing;
  end loop;

  -- ── ETAPA 2: confirma quem já pagou as 4 semanas devidas a partir da data da renovação ───────
  for r in
    select cr.id, cr.client_id, cr.seller_id, cr.renewal_date, cr.team_id, c.name client_name
    from public.contract_renewals cr
    join public.clients c on c.id = cr.client_id
    where cr.status = 'aguardando'
      and cr.bonus_deal_id is null
      and (select count(*) from public.client_payments cp
           where cp.client_id = cr.client_id
             and cp.status = 'paga'
             and coalesce(cp.due_on, cp.paid_on) >= cr.renewal_date) >= 4
    order by cr.renewal_date, cr.client_id
  loop
    insert into public.deals(seller_id, client_id, client_name, valor_total_usd, teto_semanas,
      valor_por_semana_usd, comissao_percentual, status, data_fechamento, team_id, kind)
    values (r.seller_id, r.client_id, r.client_name || ' (renovação trimestral)', 50, 1, 50, null,
      'concluido', r.renewal_date, r.team_id, 'renewal')
    returning id into v_deal;

    insert into public.weekly_payments(deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id)
    values (v_deal, 1, 50, r.renewal_date, v_rate, r.team_id)
    returning id into v_payment;

    update public.contract_renewals
       set bonus_deal_id = v_deal, bonus_payment_id = v_payment,
           status = 'confirmada', status_changed_at = now()
     where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

commit;
