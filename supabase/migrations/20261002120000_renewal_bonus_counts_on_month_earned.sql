-- Bônus de renovação passa a contar no MÊS EM QUE FOI GANHO, não no mês do trimestre.
--
-- Complementa 20260901120000_renewal_requires_four_paid_weeks.sql, que criou as duas etapas
-- ('aguardando' → 'confirmada' depois de 4 semanas pagas) mas manteve o dinheiro datado em
-- renewal_date. Como o bônus só é liberado DEPOIS das 4 semanas, ele caía sempre num mês anterior
-- ao da liberação — e quase sempre num mês já fechado.
--
-- Aconteceu de verdade: Idan e Silvano qualificaram em 25 e 26/09/2026, mas os US$50 de cada um
-- foram lançados em 29 e 30/08, mudando agosto depois de agosto ter fechado. Outros quatro bônus
-- (Emerson, Matheus, Mizael, Diego) iam somar US$200 em setembro ao longo de outubro.
--
-- A regra do negócio para semanas é "pagamento confirmado em outro mês conta no mês em que
-- confirmou". O bônus passa a seguir a mesma regra: paid_on = paid_on da 4ª semana qualificadora,
-- o instante em que o bônus foi efetivamente ganho. Datar pelo dia em que o cron roda seria
-- equivalente na prática, mas não reproduzível — reprocessar daria outro número.
--
-- data_fechamento do deal continua em renewal_date: a renovação ACONTECEU naquele dia, só o dinheiro
-- se move. É o mesmo desenho das vendas, onde o deal fecha numa data e as semanas são pagas depois.
--
-- Idan e Silvano NÃO foram remanejados — decisão do Lucas em 02/10/2026: corrigir daqui pra frente,
-- os que já estão ficam como estão.

begin;

CREATE OR REPLACE FUNCTION public.process_due_renewals(p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare r record; v_deal uuid; v_payment uuid; v_rate numeric; v_count integer := 0;
begin
  select case when cotacao_travada and cotacao_manual is not null then cotacao_manual
              else coalesce(cotacao_referencia, cotacao_manual, 1) end
    into v_rate from public.fx_config where id = 1;
  v_rate := coalesce(v_rate, 1);

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
    insert into public.contract_renewals(client_id, seller_id, renewal_number, anchor_date, renewal_date, bonus_usd, team_id, status)
    values (r.client_id, r.seller_id, r.renewal_number, r.anchor_date, r.renewal_date, 50, r.team_id, 'aguardando')
    on conflict (client_id, renewal_number) do nothing;
  end loop;

  for r in
    select cr.id, cr.client_id, cr.seller_id, cr.renewal_date, cr.team_id, c.name client_name,
           q.earned_on
    from public.contract_renewals cr
    join public.clients c on c.id = cr.client_id
    -- As 4 primeiras semanas que contam a partir da renovação. earned_on = a última delas a ser paga,
    -- ou seja, o dia em que a quarta entrou. max() e não "a 4ª da ordem" porque um pagamento pode ser
    -- confirmado fora de ordem: o bônus só está ganho quando TODAS as quatro estão em mãos.
    join lateral (
      select max(coalesce(p.paid_on, p.due_on)) as earned_on, count(*) as n
        from (select cp2.paid_on, cp2.due_on
                from public.client_payments cp2
               where cp2.client_id = cr.client_id
                 and cp2.status = 'paga'
                 and coalesce(cp2.due_on, cp2.paid_on) >= cr.renewal_date
               order by coalesce(cp2.due_on, cp2.paid_on), cp2.paid_on
               limit 4) p
    ) q on q.n >= 4 and q.earned_on is not null
    where cr.status = 'aguardando'
      and cr.bonus_deal_id is null
    order by cr.renewal_date, cr.client_id
  loop
    insert into public.deals(seller_id, client_id, client_name, valor_total_usd, teto_semanas,
      valor_por_semana_usd, comissao_percentual, status, data_fechamento, team_id, kind)
    values (r.seller_id, r.client_id, r.client_name || ' (renovação trimestral)', 50, 1, 50, null,
      'concluido', r.renewal_date, r.team_id, 'renewal')
    returning id into v_deal;

    insert into public.weekly_payments(deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id)
    values (v_deal, 1, 50, r.earned_on, v_rate, r.team_id)
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
