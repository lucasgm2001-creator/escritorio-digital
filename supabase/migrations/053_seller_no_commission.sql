-- 053 PRODUCT-SPRINT-003 (Parte 3): vendedor que NÃO gera comissão (dono/sócio).
-- Regra: cliente/lead cujo RESPONSÁVEL é um vendedor com gera_comissao=false NUNCA gera comissão — nem semanal,
-- nem de reunião, nem de upgrade, para ninguém. A RECEITA (client_payments) continua normal; só a COMISSÃO some.
-- O Daniel (dono da empresa) entra como vendedor com a flag DESLIGADA, então "Responsável: Daniel" = zero comissão.
-- Aditivo, sem drops, sem tocar no motor financeiro.
alter table public.sellers add column if not exists gera_comissao boolean not null default true;

-- Garante o Daniel como responsável SEM comissão em cada equipe que ainda não tem um (realidade atual: 1 equipe).
-- Assim "Responsável: Daniel" já resolve para este vendedor (ilike 'daniel') com gera_comissao=false.
insert into public.sellers (name, status, gera_comissao, team_id)
select 'Daniel', 'ativo', false, t.id
  from public.teams t
 where not exists (select 1 from public.sellers s where s.team_id = t.id and lower(s.name) like '%daniel%');

-- Idempotente: qualquer vendedor "Daniel" já existente também fica sem comissão.
update public.sellers set gera_comissao = false where lower(name) like '%daniel%';
