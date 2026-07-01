# Equipes e permissoes

Este documento e a referencia oficial da arquitetura planejada de equipes e permissoes do Escritorio Digital v2.

## Conceito de equipe

Uma equipe representa um espaco de trabalho compartilhado. Dados de negocio, como leads, clientes, vendedores, tarefas, comissoes, funil, materiais e configuracoes operacionais, pertencem a uma equipe.

Uma conta de usuario pode participar de uma ou mais equipes. Por isso, a equipe nao deve ser armazenada diretamente em `profiles`. A associacao correta entre usuario e equipe e feita por `team_members`.

Entidades principais:

- `profiles`: perfil individual do usuario.
- `teams`: cadastro da equipe.
- `team_members`: associacao entre usuario e equipe, incluindo papel e permissoes.
- `team_invites`: codigos de convite/acesso para entrada em equipes.

## Papeis

### Owner

Owner e o dono principal da equipe.

Responsabilidades planejadas:

- Gerenciar a equipe.
- Ver e copiar codigo de acesso.
- Convidar membros.
- Promover membros para Admin.
- Rebaixar Admins para Membro.
- Remover membros.
- Controlar configuracoes sensiveis da equipe.

Regras:

- Toda equipe deve ter pelo menos um Owner.
- O Owner inicial da equipe `DR Growth M.` sera Lucas.
- Nao deve ser possivel remover o ultimo Owner sem transferir propriedade antes.

### Admin

Admin e um membro com permissao elevada dentro da equipe.

Responsabilidades planejadas:

- Gerenciar membros comuns.
- Promover ou rebaixar membros, conforme regras definidas.
- Gerenciar configuracoes operacionais da equipe.
- Acessar areas administrativas autorizadas.

Regras:

- Admin nao deve existir por fallback automatico.
- Admin deve ser concedido explicitamente por Owner/Admin autorizado.
- Um usuario que entra por codigo nunca entra como Admin automaticamente.

### Membro

Membro e o papel padrao de quem entra na equipe por codigo.

Responsabilidades planejadas:

- Acessar dados permitidos da equipe.
- Trabalhar em fluxos autorizados por modulo.
- Nao gerenciar permissoes de outros membros.

Regras:

- Todo usuario que entra por convite deve ser Membro inicialmente.
- Promocao para Admin exige acao explicita de Owner/Admin.

## Convites e codigo de acesso

Cada equipe deve possuir um mecanismo de entrada por codigo de acesso.

Fluxo planejado:

1. Owner/Admin acessa Configuracoes > Equipes.
2. O sistema exibe ou gera um codigo de acesso da equipe.
3. Owner/Admin copia e envia o codigo para outra pessoa.
4. O novo usuario cria conta normalmente.
5. O novo usuario informa o codigo.
6. O sistema cria um registro em `team_members`.
7. O usuario entra como Membro comum.

O codigo deve identificar a equipe, mas nao deve conceder privilegios administrativos.

## activeTeamId

`activeTeamId` sera a referencia da equipe atualmente selecionada pelo usuario.

Objetivos:

- Isolar leitura de dados por equipe.
- Isolar escrita de dados por equipe.
- Permitir alternancia entre equipes.
- Evitar que um usuario membro de varias equipes veja dados misturados.

Regras planejadas:

- Toda query de dados de negocio deve filtrar por `activeTeamId`.
- Todo insert de dados de negocio deve gravar `team_id = activeTeamId`.
- Se o usuario tiver apenas uma equipe, ela pode ser usada como fallback temporario.
- Se o usuario tiver varias equipes, o app deve exigir uma equipe ativa clara.
- A equipe ativa deve ser persistida de forma segura, por exemplo em preferencia local ou estado server-side validado.

## Alternancia entre equipes

Um usuario pode participar de mais de uma equipe. A interface deve permitir alternar a equipe ativa.

Comportamento esperado:

- Ao trocar equipe, as telas recarregam dados da nova equipe.
- Nenhum dado da equipe anterior deve permanecer misturado na tela.
- A URL ou estado da aplicacao deve deixar claro qual equipe esta ativa, ou o backend deve validar o `activeTeamId` em todas as operacoes.
- A troca de equipe deve respeitar RLS e associacao em `team_members`.

## Permissoes futuras por modulo

A arquitetura deve permitir permissoes granulares no futuro.

Modulos provaveis:

- Hall
- Comercial
- Clientes
- Tarefas
- Vendedores
- Comissoes
- Studio
- Configuracoes
- Equipes e permissoes

Modelo inicial recomendado:

- `owner`: acesso total na equipe.
- `admin`: acesso administrativo, exceto acoes exclusivas de Owner.
- `member`: acesso operacional limitado.

Modelo futuro:

- `team_members.role` define o papel base.
- `team_members.permissions` pode armazenar excecoes granulares por modulo.
- Regras sensiveis devem ser aplicadas no banco e nas rotas server-side, nao apenas na UI.

## Estrategia de migracao sem perda de dados

Os dados atuais sao reais. A migracao para equipes deve preservar todos os registros existentes.

Principios:

- Nao apagar dados.
- Nao recriar tabelas reais.
- Nao trocar IDs existentes.
- Adicionar colunas e estruturas de forma idempotente.
- Fazer backfill de `team_id` apenas onde estiver nulo.
- Endurecer RLS somente depois que o app estiver usando `activeTeamId`.

Sequencia segura:

1. Documentar estado atual.
2. Versionar o schema de equipes ja existente no Supabase real.
3. Preservar o `team_id` atual da equipe inicial.
4. Renomear a equipe atual para `DR Growth M.`.
5. Garantir Lucas como Owner/Admin dessa equipe.
6. Corrigir registros sem `team_id`, como os `stage_events` orfaos.
7. Criar helper de equipe ativa.
8. Filtrar leituras por equipe ativa.
9. Gravar novas escritas com `team_id`.
10. Reforcar RLS e constraints depois das validacoes.

## Fluxo de criacao de equipe

1. Usuario autenticado sem equipe acessa onboarding.
2. Usuario informa nome da equipe.
3. Sistema cria registro em `teams`.
4. Sistema cria registro em `team_members` para o usuario criador.
5. Usuario criador recebe papel `owner`.
6. Sistema cria ou disponibiliza codigo de acesso da equipe.
7. Usuario entra no dashboard da equipe criada.

## Fluxo de entrada em equipe

1. Usuario cria conta normalmente.
2. Usuario sem equipe ve onboarding ou estado vazio.
3. Usuario informa codigo de acesso.
4. Sistema valida o codigo.
5. Sistema cria registro em `team_members`.
6. Usuario entra como `member`.
7. Dashboard passa a carregar dados da equipe associada.

## Fluxo de promocao de membros

1. Owner/Admin acessa Configuracoes > Equipes.
2. Owner/Admin abre a lista de membros.
3. Owner/Admin seleciona um membro.
4. Sistema valida se quem executa a acao tem permissao na equipe ativa.
5. Sistema atualiza `team_members.role`.
6. O membro promovido passa a ter as permissoes do novo papel.

Regras de protecao:

- Membro comum nao promove ninguem.
- Admin nao deve remover o ultimo Owner.
- Mudancas de papel devem ser auditaveis.
- A UI pode esconder acoes, mas a seguranca real deve estar no banco/servidor.
