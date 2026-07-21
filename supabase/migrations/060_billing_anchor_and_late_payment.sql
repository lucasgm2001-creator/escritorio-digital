-- 060 — Atraso não desloca recorrência; somente o primeiro pagamento define a data-base.
alter table public.clients add column if not exists billing_anchor_date date;

create or replace function public.set_billing_anchor_from_first_payment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.numero_semana = 1 and new.status = 'paga' and new.paid_on is not null then
    -- Na primeira semana, a data paga vira também o primeiro vencimento e ancora as próximas +7 dias.
    new.due_on := new.paid_on;
    update public.clients
       set billing_anchor_date = new.paid_on,
           dia_pagamento_semana = extract(dow from new.paid_on)::integer
     where id = new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_payment_first_week_anchor on public.client_payments;
create trigger trg_client_payment_first_week_anchor
before insert or update of status, paid_on on public.client_payments
for each row execute function public.set_billing_anchor_from_first_payment();

create index if not exists idx_clients_billing_anchor on public.clients(team_id, billing_anchor_date);
