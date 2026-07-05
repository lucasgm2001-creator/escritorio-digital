-- 049 F2 — Cobrança mensal (ADITIVO). NÃO cria 2º motor: a unidade continua a SEMANA; "mensal" só
-- agrupa (ver payMonth em src/lib/commission/actions.ts). plans.valor_mensal é referência de exibição
-- (= 4× semanal, sem desconto, igual ao exemplo Start 140→560). clients.periodicidade define como o
-- cliente é cobrado (o pagamento em si reusa payClientWeek). Nenhuma RLS nova; nenhuma regra de dinheiro muda.
--
-- STATUS: NÃO aplicada automaticamente (guarda de deploy de produção). Aplicar após revisão:
--   supabase db push   (ou apply_migration fora do modo auto).

alter table public.plans add column if not exists valor_mensal numeric;

alter table public.clients add column if not exists periodicidade text not null default 'semanal';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_periodicidade_chk') then
    alter table public.clients add constraint clients_periodicidade_chk check (periodicidade in ('semanal','mensal'));
  end if;
end $$;

-- Seed do mensal = 4× semanal (sem desconto) onde ainda nulo. O motor IGNORA este campo (usa valor_semanal).
update public.plans set valor_mensal = round(valor_semanal * 4, 2) where valor_mensal is null;
