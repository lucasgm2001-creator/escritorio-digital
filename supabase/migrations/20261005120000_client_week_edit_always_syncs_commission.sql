-- Editar a semana de um cliente tem de SEMPRE refletir na remuneração. Não refletia em parte dos casos.
--
-- save_client_week apagava a comissão com `where client_payment_id = v_row.id`. Mas payWeek (usado pelo
-- cron auto-weeks e pelo fluxo manual de Comissões) inseria em weekly_payments SEM preencher
-- client_payment_id — 13 linhas, US$486,80, estavam sem vínculo. Nessas, desmarcar a semana do cliente
-- deixava a comissão viva: a receita caía e a remuneração continuava dizendo que a semana foi paga.
-- É exatamente o sintoma relatado ("consta no relatório de remuneração que ela pagou tantas semanas").
--
-- Duas mudanças:
--   1) O DELETE passa a casar por (cliente do deal, numero_semana) — o fato real: "esta semana não está
--      mais paga, logo não há comissão de venda dela" — em vez de depender de um vínculo que pode não ter
--      sido gravado.
--   2) Backfill do client_payment_id nas linhas existentes, para o vínculo também ficar correto. O lado
--      do app foi corrigido em paralelo: payWeek/deriveCommission/scheduleDueWeeks agora passam o id.
--
-- kind = 'sale' é OBRIGATÓRIO no delete: o bônus de renovação também tem numero_semana = 1 e
-- client_payment_id nulo. Sem esse filtro, desmarcar a semana 1 de um cliente apagaria o bônus de
-- renovação dele junto. Upgrade (kind='upgrade') também fica fora — suas parcelas têm regra própria.
--
-- Hoje existe exatamente UM deal de venda por cliente (verificado), então casar por cliente+semana não é
-- ambíguo. Se um dia houver dois, esta é a premissa a revisar.
--
-- Testado numa transação desfeita: Cristiane (cliente INATIVA) semana 4 paga -> nao_paga levou receita de
-- US$190 para 0 e comissão de US$38 para 0 na mesma transação.

begin;

-- 1) Backfill: liga cada comissão de venda à semana do cliente correspondente.
update weekly_payments wp
   set client_payment_id = cp.id
  from deals d
  join client_payments cp on cp.client_id = d.client_id
 where wp.deal_id = d.id
   and d.kind = 'sale'
   and cp.numero_semana = wp.numero_semana
   and wp.client_payment_id is null
   and wp.deleted_at is null;

-- 2) A função passa a sincronizar pelo fato, não pelo vínculo.
CREATE OR REPLACE FUNCTION public.save_client_week(p_client_id uuid, p_numero_semana integer, p_status text, p_due_on date, p_valor_previsto_usd numeric, p_valor_pago_usd numeric DEFAULT 0, p_paid_on date DEFAULT NULL::date, p_cotacao_usd_brl numeric DEFAULT NULL::numeric, p_plano_id uuid DEFAULT NULL::uuid, p_observacao text DEFAULT NULL::text)
RETURNS client_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_before jsonb;
  v_row public.client_payments;
  v_deal public.deals;
  v_is_revenue boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_numero_semana < 1 then raise exception 'numero de semana invalido'; end if;
  if p_status not in ('prevista','vencida','paga','nao_paga','parcial','isenta','anulada') then raise exception 'situacao invalida'; end if;
  if coalesce(p_valor_previsto_usd, 0) < 0 or coalesce(p_valor_pago_usd, 0) < 0 then raise exception 'valor invalido'; end if;
  if p_status = 'paga' and (p_paid_on is null or p_valor_pago_usd < p_valor_previsto_usd or p_valor_pago_usd <= 0) then
    raise exception 'pagamento integral exige data e valor recebido igual ou superior ao previsto';
  end if;
  if p_status = 'parcial' and (p_paid_on is null or p_valor_pago_usd <= 0 or p_valor_pago_usd >= p_valor_previsto_usd) then
    raise exception 'pagamento parcial exige valor maior que zero e menor que o previsto';
  end if;

  -- Não há filtro de status do cliente de propósito: corrigir o financeiro de um cliente DESATIVADO é
  -- justamente um dos usos desta função.
  select team_id into v_team from public.clients where id = p_client_id and deleted_at is null;
  if v_team is null then raise exception 'cliente inexistente'; end if;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;

  select to_jsonb(cp) into v_before from public.client_payments cp
  where cp.client_id = p_client_id and cp.numero_semana = p_numero_semana for update;

  v_is_revenue := p_status in ('paga','parcial');
  insert into public.client_payments (
    client_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, plano_id, team_id,
    anulado, anulado_em, anulado_motivo, status, due_on, valor_previsto_usd,
    valor_pago_usd, observacao, updated_at, updated_by
  ) values (
    p_client_id, p_numero_semana, case when v_is_revenue then p_valor_pago_usd else p_valor_previsto_usd end,
    case when v_is_revenue then p_paid_on else null end, coalesce(p_cotacao_usd_brl, 1), p_plano_id, v_team,
    not v_is_revenue, case when p_status = 'anulada' then now() else null end,
    case when p_status = 'anulada' then nullif(trim(p_observacao), '') else null end,
    p_status, p_due_on, p_valor_previsto_usd, case when v_is_revenue then p_valor_pago_usd else 0 end,
    nullif(trim(p_observacao), ''), now(), v_uid
  ) on conflict (client_id, numero_semana) do update set
    valor_usd=excluded.valor_usd, paid_on=excluded.paid_on, cotacao_usd_brl=excluded.cotacao_usd_brl,
    plano_id=excluded.plano_id, anulado=excluded.anulado, anulado_em=excluded.anulado_em,
    anulado_motivo=excluded.anulado_motivo, status=excluded.status, due_on=excluded.due_on,
    valor_previsto_usd=excluded.valor_previsto_usd, valor_pago_usd=excluded.valor_pago_usd,
    observacao=excluded.observacao, updated_at=now(), updated_by=v_uid
  returning * into v_row;

  if p_status <> 'paga' then
    -- Casa pelo FATO (cliente + semana), não pelo client_payment_id: linhas criadas pelo cron ou pelo
    -- fluxo manual de Comissões nasciam sem o vínculo e sobreviviam ao desmarcar, deixando a remuneração
    -- dizendo que a semana foi paga depois da receita cair.
    -- kind='sale' protege o bônus de renovação, que também é numero_semana=1 sem vínculo.
    delete from public.weekly_payments wp
     using public.deals d
     where wp.deal_id = d.id
       and d.kind = 'sale'
       and d.client_id = p_client_id
       and wp.numero_semana = p_numero_semana;
  else
    select d.* into v_deal from public.deals d
    join public.sellers s on s.id=d.seller_id and coalesce(s.gera_comissao,true)
    where d.client_id=p_client_id and d.status='em_andamento' and d.kind='sale'
      and p_numero_semana <= d.teto_semanas
    order by d.data_fechamento desc, d.created_at desc limit 1;
    if v_deal.id is not null then
      insert into public.weekly_payments (deal_id,numero_semana,valor_usd,paid_on,cotacao_usd_brl,team_id,client_payment_id)
      values (v_deal.id,p_numero_semana,v_deal.valor_por_semana_usd,p_paid_on,coalesce(p_cotacao_usd_brl,1),v_team,v_row.id)
      on conflict (deal_id,numero_semana) do update set paid_on=excluded.paid_on,
        cotacao_usd_brl=excluded.cotacao_usd_brl,client_payment_id=excluded.client_payment_id;
    end if;
  end if;

  insert into public.client_payment_events (client_payment_id,client_id,numero_semana,action,before_data,after_data,changed_by,team_id)
  values (v_row.id,p_client_id,p_numero_semana,case when v_before is null then 'created' else 'updated' end,
    v_before,to_jsonb(v_row),v_uid,v_team);
  return v_row;
end;
$function$;

commit;
