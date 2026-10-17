-- BÔNUS DE RENOVAÇÃO: revalidar quando a base muda, e não confirmar para cliente encerrado.
--
-- Caso real: Emerson teve o bônus confirmado em 12/10 pelo cron (4 semanas pagas desde 15/09). Depois o
-- Lucas desmarcou essas semanas e desativou o cliente. A contagem foi a ZERO e o bônus continuou vivo,
-- datado em 12/10, somando US$50 na comissão de outubro.
--
-- Eram DUAS portas abertas, não uma:
--
--   1) Desmarcar semana não reavaliava a renovação. O save_client_week apaga a comissão de VENDA da
--      semana e filtra kind='sale' de propósito, para não derrubar o bônus ao desmarcar a semana 1
--      (o bônus também é numero_semana=1). O efeito colateral: o bônus nunca mais era conferido, mesmo
--      quando as semanas que o justificaram sumiam.
--
--   2) O segundo laço do process_due_renewals — o que CONFIRMA o bônus — não filtrava cliente ativo. O
--      filtro existia só no primeiro laço (o que cria a linha 'aguardando'). Cliente já encerrado podia
--      ter bônus confirmado depois.
--
-- REGRA: bônus já ganho só cai se a CONDIÇÃO deixar de valer (as 4 semanas não estão mais pagas). Churn
-- depois de ganho NÃO desfaz — o dinheiro foi conquistado. Mas bônus novo não nasce para contrato
-- encerrado.
--
-- Ao revalidar, a renovação volta para 'aguardando' com os ids limpos: se as semanas forem remarcadas
-- como pagas, ela qualifica de novo pelo caminho normal. O deal e o pagamento ficam soft-deleted como
-- trilha do que houve.
--
-- Testado em transação desfeita com o Matheus: desmarcar uma das 4 semanas levou o bônus de 1 para 0 e
-- a renovação de 'confirmada' para 'aguardando', na mesma transação da semana.

begin;

create or replace function public.revalidate_client_renewals(p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_count integer := 0;
begin
  for r in
    select cr.id, cr.client_id, cr.renewal_date, cr.bonus_deal_id, cr.bonus_payment_id
      from public.contract_renewals cr
     where cr.client_id = p_client_id
       and cr.status = 'confirmada'
       and cr.bonus_payment_id is not null
       and (select count(*) from public.client_payments cp
             where cp.client_id = cr.client_id
               and cp.status = 'paga'
               and coalesce(cp.due_on, cp.paid_on) >= cr.renewal_date) < 4
  loop
    update public.weekly_payments
       set deleted_at = now(), deleted_by = auth.uid()
     where id = r.bonus_payment_id and deleted_at is null;

    update public.deals set status = 'interrompido' where id = r.bonus_deal_id;

    update public.contract_renewals
       set status = 'aguardando',
           bonus_deal_id = null,
           bonus_payment_id = null,
           status_note = 'Bônus revogado: as 4 semanas que o justificavam deixaram de estar pagas.',
           status_changed_at = now(),
           status_changed_by = auth.uid()
     where id = r.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

comment on function public.revalidate_client_renewals(uuid) is
  'Revoga bônus de renovação cuja condição (4 semanas pagas a partir da renovação) deixou de valer. Volta a aguardando para poder requalificar.';

-- save_client_week passa a revalidar ao final de cada mudança de semana, na MESMA transação.
-- (Aplicado em produção por edição do corpo da função; aqui fica declarado para um banco novo.)
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_client_week';
  if def is null then raise notice 'save_client_week ainda não existe — nada a ligar'; return; end if;
  if position('revalidate_client_renewals' in def) > 0 then return; end if;
  def := replace(def,
    '  return v_row;' || chr(10) || 'end;',
    '  -- A semana mudou: o bônus de renovação deste cliente pode ter perdido a base (4 semanas pagas' || chr(10) ||
    '  -- a partir da renovação). Revalida aqui, na MESMA transação que mexeu na semana.' || chr(10) ||
    '  perform public.revalidate_client_renewals(p_client_id);' || chr(10) || chr(10) ||
    '  return v_row;' || chr(10) || 'end;');
  execute def;
end $$;

-- process_due_renewals: o laço que CONFIRMA o bônus passa a exigir cliente ativo.
do $$
declare def text; antes text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'process_due_renewals';
  if def is null then raise notice 'process_due_renewals ainda não existe'; return; end if;
  antes := def;
  if position('and c.status = ''ativo''' || chr(10) || '      and c.deleted_at is null' in def) > 0 then return; end if;
  def := replace(def,
    '    where cr.status = ''aguardando''' || chr(10) || '      and cr.bonus_deal_id is null',
    '    where cr.status = ''aguardando''' || chr(10) ||
    '      and cr.bonus_deal_id is null' || chr(10) ||
    '      -- Cliente encerrado NÃO começa a receber bônus de renovação. O filtro existia só no primeiro' || chr(10) ||
    '      -- laço (o que cria a linha ''aguardando''); aqui, que é onde o dinheiro nasce, faltava.' || chr(10) ||
    '      and c.status = ''ativo''' || chr(10) ||
    '      and c.deleted_at is null');
  if def = antes then raise exception 'padrão não encontrado em process_due_renewals'; end if;
  execute def;
end $$;

commit;
