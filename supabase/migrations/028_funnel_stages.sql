-- 028_funnel_stages.sql  (JÁ APLICADA no banco — documentação, idempotente)
-- Fases do funil configuráveis. Incremento 1 = código LÊ as fases daqui; comportamento idêntico
-- ao de hoje (mesmos slugs/ordem/significado). NÃO dropa a CHECK de leads.status (incremento 2).

create table if not exists public.funnel_stages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,        -- usado em leads.status; estável (não muda ao renomear)
  nome            text not null,
  posicao         integer not null default 0,
  is_won          boolean not null default false,
  is_lost         boolean not null default false,
  is_system       boolean not null default false,
  conta_interagiu boolean not null default false,
  conta_reuniao   boolean not null default false,
  conta_fechou    boolean not null default false,
  cor             text,
  arquivada       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.funnel_stages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='funnel_stages' and policyname='Auth le fases') then
    create policy "Auth le fases" on public.funnel_stages for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='funnel_stages' and policyname='Auth gere fases') then
    create policy "Auth gere fases" on public.funnel_stages for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

create index if not exists idx_funnel_stages_pos on public.funnel_stages (posicao) where arquivada = false;
-- No máximo 1 won e 1 lost (âncora do dinheiro/perda):
create unique index if not exists uq_funnel_won  on public.funnel_stages (is_won)  where is_won;
create unique index if not exists uq_funnel_lost on public.funnel_stages (is_lost) where is_lost;

-- SEED das 10 fases de hoje (mesmos slugs/ordem; conta_* = mapa de marcos atual).
insert into public.funnel_stages (slug,nome,posicao,is_won,is_lost,is_system,conta_interagiu,conta_reuniao,conta_fechou) values
 ('novo','Novo Lead',1,false,false,true ,false,false,false),
 ('interagiu','Interagiu',2,false,false,false,true ,false,false),
 ('nao_interagiu','Não Interagiu',3,false,false,false,false,false,false),
 ('reuniao','Reunião Agendada',4,false,false,false,true ,false,false),
 ('no_show','No-Show',5,false,false,false,true ,false,false),
 ('reagendamento','Reagendamento',6,false,false,false,true ,false,false),
 ('proposta','Proposta em Análise',7,false,false,false,true ,true ,false),
 ('fechado','Venda Fechada',8,true ,false,true ,true ,true ,true ),
 ('perdido','Venda Perdida',9,false,true ,true ,false,false,false),
 ('lixeira','Lixeira',10,false,false,true ,false,false,false)
on conflict (slug) do nothing;
