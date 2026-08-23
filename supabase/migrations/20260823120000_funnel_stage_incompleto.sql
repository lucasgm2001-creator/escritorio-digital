-- Fase "Incompleto" — lead sem telefone para ligar.
--
-- A integração com o Magnetic Funnels joga TODO lead novo em "Novo Lead", inclusive os que chegam sem
-- telefone. Como o primeiro passo da operação é ligar, esses leads entopem a coluna de entrada sem que
-- exista ação possível. Passam a nascer aqui, no fim do funil, ao lado de "Não Respondeu".
--
-- Não é fase ganha, perdida nem arquivada: continua visível como coluna (para revisar e completar o
-- cadastro), mas fora do caminho de trabalho. Sem dias_esfriamento — não faz sentido "esfriar" um lead
-- que nunca pôde ser trabalhado. Os contadores de funil (conta_interagiu/reuniao/fechou) ficam falsos:
-- um lead incompleto não é interação nem etapa de negociação.
--
-- is_system = false de propósito: a equipe pode renomear/reordenar como quiser.
-- Idempotente por (team_id, slug) e criada para TODA equipe que já tenha funil.

begin;

insert into public.funnel_stages (team_id, slug, nome, posicao, grupo, cor, is_won, is_lost, is_system, arquivada, dias_esfriamento, conta_interagiu, conta_reuniao, conta_fechou)
select t.team_id, 'incompleto', 'Incompleto', coalesce(max_pos.p, 0) + 1, 'Arquivo', '#7C3AED',
       false, false, false, false, null, false, false, false
from (select distinct team_id from public.funnel_stages) t
cross join lateral (select max(posicao) p from public.funnel_stages f where f.team_id = t.team_id) max_pos
where not exists (
  select 1 from public.funnel_stages f2 where f2.team_id = t.team_id and f2.slug = 'incompleto'
);

commit;
