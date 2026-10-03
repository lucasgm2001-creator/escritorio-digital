-- Alinha os bônus de renovação JÁ EXISTENTES à regra corrigida na migration anterior
-- (20261002120000_renewal_bonus_counts_on_month_earned.sql): o bônus conta no mês em que foi GANHO.
--
-- Decisão do Lucas em 03/10/2026, revisando a de 02/10: corrigir também os anteriores. Idan e Silvano
-- qualificaram em 25 e 26/09 mas estavam lançados em 29 e 30/08 — US$100 no mês errado.
--
-- Efeito: agosto vai de US$698,80 para US$598,80 e setembro de US$558,80 para US$658,80. O total do
-- período não muda: os US$100 só trocam de mês.
--
-- A nova data NÃO é digitada: sai da MESMA expressão que process_due_renewals usa (paid_on da 4ª semana
-- qualificadora), para o resultado ser idêntico ao que a função produziria hoje. Rodar de novo é inócuo
-- — o WHERE só toca linha cuja data divirja.
--
-- data_fechamento do deal fica em renewal_date: a renovação aconteceu naquele dia, só o dinheiro se move.
-- cotacao_usd_brl fica congelada em 5, que é a mesma cotação vigente — mover a data não a altera.
--
-- Não há tabela de fechamento mensal: os totais são calculados ao vivo a partir de weekly_payments.paid_on,
-- então este UPDATE é a correção completa.

begin;

with earned as (
  select cr.bonus_payment_id as payment_id, q.earned_on
    from contract_renewals cr
    join weekly_payments wp on wp.id = cr.bonus_payment_id and wp.deleted_at is null
    join lateral (
      select max(coalesce(p.paid_on, p.due_on)) as earned_on, count(*) as n
        from (select cp2.paid_on, cp2.due_on
                from client_payments cp2
               where cp2.client_id = cr.client_id
                 and cp2.status = 'paga'
                 and coalesce(cp2.due_on, cp2.paid_on) >= cr.renewal_date
               order by coalesce(cp2.due_on, cp2.paid_on), cp2.paid_on
               limit 4) p
    ) q on q.n >= 4 and q.earned_on is not null
   where cr.status = 'confirmada'
)
update weekly_payments wp
   set paid_on = e.earned_on
  from earned e
 where wp.id = e.payment_id
   and wp.paid_on <> e.earned_on;

commit;
