-- IR OU NÃO PARA O GOOGLE AGENDA passa a ser escolha da tarefa (TAREFA-AGENDA-001).
--
-- Até aqui, TODA tarefa com data virava evento no Google: 429 tarefas, 155 com evento criado. A agenda
-- enchia de "Ligar para fulano" e "Acompanhar proposta", quando o que deve estar no calendário é
-- compromisso com hora marcada — call e reunião.
--
-- Agora existe `sync_calendar`. O default da COLUNA é false (tarefa comum não vai), e a regra de quem
-- nasce ligado vive em lib/tasks/task-kind (syncCalendarPadrao: reunião e agendamento), onde o tipo da
-- tarefa é conhecido — e não num default cego de banco. Tarefa nasce em cinco lugares (formulário, funil,
-- drawer de situação, agente, webhook) e todos passaram a ler a mesma função.
--
-- BACKFILL CRÍTICO: tudo que JÁ tem google_event_id nasce com true. Sem isto, a primeira sincronização
-- depois do deploy leria sync_calendar = false e APAGARIA os 155 eventos existentes da agenda real.
--
-- Tarefa antiga SEM evento fica em false de propósito: ligar retroativamente criaria dezenas de eventos
-- passados do nada. Quem quiser um deles no calendário abre a tarefa e liga o botão.
--
-- Desligar o botão numa tarefa já sincronizada REMOVE o evento (googleCalendar.syncTaskCalendar trata
-- sync_calendar=false no mesmo ramo do "sem data"): um botão que desliga mas deixa o evento mentiria
-- sobre o que o calendário contém.

alter table public.tasks
  add column if not exists sync_calendar boolean not null default false;

update public.tasks set sync_calendar = true where google_event_id is not null;

comment on column public.tasks.sync_calendar is
  'Se esta tarefa deve existir como evento no Google Agenda. Desligar remove o evento no próximo sync.';
