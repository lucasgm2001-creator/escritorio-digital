-- LEAD-INTERACTIONS-SITUACAO-001 — idempotente (pode rodar mais de uma vez).
--
-- PROBLEMA: a tabela lead_interactions nasceu (003_leads) com CHECK de tipos fixo:
--   atendeu, nao_atendeu, mensagem, reuniao, proposta, nota, sistema
-- e depois ganhou 'ligacao' direto no banco (fora das migrations). 'situacao' (Registrar contato) e 'briefing'
-- (Briefing IA) NUNCA entraram: todo insert desses tipos era recusado e o código não checava o erro → falha
-- silenciosa. Resultado: a "Observação" do Registrar contato nunca chegou às Observações do lead/cliente (o
-- gatilho sync_lead_interaction_observation não dispara sem a linha) — só sobrava current_situation, que é
-- sobrescrita a cada registro. Não acumulava.

-- 1) Lista de tipos completa (todos os que o código grava + os que já existem nos dados).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.lead_interactions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.lead_interactions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.lead_interactions add constraint lead_interactions_type_check check (type in (
  'atendeu', 'nao_atendeu', 'mensagem', 'reuniao', 'proposta', 'nota', 'sistema', 'ligacao',
  'situacao', 'briefing'
));

-- 2) Recupera a ÚLTIMA observação digitada de cada lead (as anteriores nunca foram gravadas — perdidas).
--    current_situation guarda o texto digitado quando houve; sem texto, guarda o rótulo automático do resultado
--    (lista abaixo = LAST_ACTION_LABEL do app) — esses NÃO viram observação. Data = quando foi escrita.
--    Não duplica: pula se o mesmo texto já está nas Observações do lead; source_id = lead (1 por lead).
insert into public.entity_observations (
  team_id, entity_type, entity_id, body, source_type, source_id, source_label, created_at, updated_at
)
select l.team_id, 'lead', l.id, trim(l.current_situation), 'situacao_recuperada', l.id,
       'Atualização da situação (recuperada)', coalesce(l.situation_updated_at, now()), now()
from public.leads l
where l.deleted_at is null
  and l.team_id is not null
  and nullif(trim(l.current_situation), '') is not null
  and trim(l.current_situation) not in (
    'Respondeu interessado',
    'Pediu retorno',
    'Marcou reunião',
    'Recebeu proposta',
    'Não respondeu',
    'Desistiu',
    'Fechou',
    'Sem mudança',
    'Ligação: não atendeu',
    'Ligação: ocupado',
    'Ligação: caixa postal',
    'Ligação: conversou',
    'Ligação: marcou reunião',
    'Ligação: pediu proposta',
    'Ligação: já é cliente',
    'Ligação: número inválido',
    'Pediu proposta',
    'Já é cliente',
    'Não visualizou',
    'Visualizou',
    'Respondeu',
    'WhatsApp: pediu proposta',
    'WhatsApp: marcou reunião',
    'Parou de responder',
    'Cliente pediu proposta',
    'Cliente quer reunião',
    'Cliente tirou dúvidas',
    'Cliente quer fechar',
    'Cliente quer negociar',
    'Cliente pediu retorno',
    'Reunião realizada',
    'Não compareceu à reunião',
    'Pediu para reagendar a reunião',
    'Pediu proposta na reunião',
    'Proposta apresentada na reunião',
    'Cancelou a reunião',
    'Proposta enviada',
    'Proposta aceita',
    'Pediu ajuste na proposta',
    'Proposta recusada',
    'Não respondeu à proposta',
    'Respondeu ao follow-up',
    'Não respondeu ao follow-up',
    'Pediu retorno no follow-up',
    'Reunião marcada',
    'Não respondeu ao agendamento',
    'Pediu retorno para marcar',
    'Não quis marcar reunião'
  )
  and not exists (
    select 1 from public.entity_observations o
    where o.team_id = l.team_id and o.entity_type = 'lead' and o.entity_id = l.id
      and trim(o.body) = trim(l.current_situation)
  )
on conflict (team_id, entity_type, entity_id, source_type, source_id) where source_id is not null do nothing;
