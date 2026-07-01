# Decisoes importantes

Este documento registra decisoes arquiteturais e de produto que devem orientar futuras implementacoes do Escritorio Digital v2.

## Arquitetura de equipes

- O sistema evoluiu de um modelo de usuario unico para um modelo baseado em equipes.
- Uma conta pode participar de varias equipes.
- `profiles` representa o perfil individual do usuario.
- `profiles` nao representa a equipe.
- `team_members` e a fonte da associacao entre usuario e equipe.
- Cada equipe possui Owner, Admins e Membros.
- Lucas permanece Owner/Admin da equipe inicial.
- A equipe inicial sera `DR Growth M.`.
- Daniel ainda nao possui conta e nao deve ser criado manualmente neste momento.
- Quando Daniel criar conta, ele deve entrar por codigo de convite e ser promovido depois por Lucas.

## Permissoes

- Apenas Owner/Admin podem conceder permissoes.
- Um membro entra sempre como membro comum.
- Apenas um Admin/Owner pode promover outro membro.
- Apenas um Admin/Owner pode rebaixar ou remover membros, respeitando regras de protecao do Owner.
- `profiles.role` deve deixar de ser a unica fonte de autorizacao conforme a arquitetura evoluir para equipes.
- A autorizacao futura deve considerar o papel do usuario dentro da equipe ativa.
- Permissoes por modulo devem ser planejadas sobre `team_members.role` e possiveis permissoes granulares.

## Onboarding e convites

- Uma conta nova pode ser criada normalmente.
- Um novo usuario entra sem equipe.
- Usuario sem equipe deve ver um estado vazio ou fluxo de onboarding, sem acesso a dados de equipes existentes.
- O ingresso em uma equipe ocorre por codigo de convite.
- O codigo de convite deve associar o usuario a uma equipe existente.
- Ao entrar por codigo, o usuario deve virar membro comum.
- Promocao para Admin deve acontecer somente depois, por acao explicita de Owner/Admin.

## Isolamento de dados

- `activeTeamId` sera utilizado para isolar leitura e escrita entre equipes.
- Toda leitura de dados de negocio deve considerar a equipe ativa.
- Toda escrita de dados de negocio deve gravar o `team_id` da equipe ativa.
- Um usuario com mais de uma equipe deve conseguir alternar entre equipes.
- A alternancia de equipe nao deve misturar dados entre equipes.
- Toda nova funcionalidade devera considerar multiplas equipes desde sua concepcao.

## Dados reais e migracoes

- Os dados atuais sao reais e nao podem ser perdidos.
- Toda migracao deve ser aditiva e idempotente.
- Nunca usar `DROP TABLE` em tabelas reais.
- Nunca recriar tabelas reais populadas.
- Nunca usar `TRUNCATE` em dados reais.
- Nao trocar IDs existentes de equipe, usuario ou dados de negocio.
- Backfills devem ser restritos, auditaveis e reversiveis quando possivel.
- Antes de endurecer RLS, o app deve estar preparado para enviar e filtrar por `activeTeamId`.
- Constraints mais fortes, como `team_id not null`, devem ser aplicadas somente depois de confirmar que nao existem dados orfaos.

## Documentacao

- Decisoes arquiteturais devem ser registradas neste documento.
- Auditorias tecnicas devem ser preservadas em `docs/07-auditorias/` quando a estrutura final for aplicada.
- Migrations sensiveis devem ter plano, verificacao antes/depois e justificativa documentada.
