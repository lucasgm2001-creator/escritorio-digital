# Revisão de segurança — 21/07/2026

## Escopo

Aplicação Next.js, autenticação Supabase, autorização por equipe/módulo, RLS do PostgreSQL,
Storage, APIs, webhooks, uploads, OAuth, segredos, dependências e publicação Vercel.

## Vulnerabilidades confirmadas e corrigidas

- **Crítica — autorização granular anulada por policies antigas:** policies `ALL` permissivas
  permitiam escrita direta por membros com acesso somente leitura. Foram substituídas por policies
  separadas de leitura, edição e administração, ligadas às permissões efetivas do módulo.
- **Alta — Storage entre equipes:** usuários autenticados podiam sobrescrever/excluir arquivos fora
  de seu escopo. Uploads agora exigem usuário/equipe/módulo corretos e caminhos são isolados por equipe.
- **Alta — materiais de clientes públicos:** o bucket `materiais` tornou-se privado. A aplicação gera
  URLs assinadas temporárias (4 horas) somente após a RLS autorizar a equipe.
- **Alta — RPC financeira exposta:** `process_due_renewals` podia ser invocada por usuário/anon.
  Agora é exclusiva de `service_role`; funções internas e triggers deixaram de ser RPCs públicas.
- **Alta — perfil com atualização ampla:** a API permitia tentar alterar colunas internas do próprio
  perfil. O banco agora concede UPDATE apenas a nome, avatar, telefone, logo e link de chamada.
- **Alta — ausência de CSP/cabeçalhos:** adicionados CSP com nonce por requisição, bloqueio de iframe,
  HSTS, `nosniff`, política de referência, política de recursos do navegador e `no-store`.
- **Média — CSRF em APIs de sessão:** POSTs autenticados agora validam `Origin` e `Sec-Fetch-Site`.
- **Média — segredos em query string:** webhooks de leads aceitam segredo somente em header, evitando
  vazamento em histórico, analytics e logs de proxy.
- **Média — redirecionamento por Host não confiável:** callbacks usam a URL canônica configurada.
- **Média — rate limit local:** cotas agora são atômicas e compartilhadas no banco entre instâncias.
- **Média — assinatura Stripe incompleta:** incluída validação HMAC, tempo constante e janela anti-replay.
- **Média — worker PDF externo:** o worker é empacotado com o app, sem JavaScript executado de CDN.
- **Baixa — política de senha:** novos cadastros e trocas exigem ao menos 12 caracteres.

## Evidências de validação

- `npm audit --omit=dev`: zero vulnerabilidades de produção.
- ESLint e build de produção: aprovados.
- Testes de comissão: aprovados.
- Supabase DB lint: zero erros.
- Simulação RLS: membro enxerga o lead da equipe, mas uma tentativa de UPDATE retorna zero linhas;
  owner mantém acesso administrativo.
- Storage: zero policies públicas de listagem; bucket `materiais` privado.
- RPC: renovação automática negada a `anon` e `authenticated`, permitida somente a `service_role`.
- HTTP local: CSP nonce presente no header e HTML, rota protegida redireciona sem sessão e POST de
  origem externa retorna 403.

## Riscos residuais e próximos controles

- Ativar no painel Supabase a proteção contra senhas vazadas (Have I Been Pwned). O recurso aparece
  desativado no advisor e pode depender do plano contratado.
- MFA/TOTP ainda não existe na experiência do produto. É a principal evolução recomendada para
  owners, administradores e financeiro.
- O CLI da Vercel, usado apenas em desenvolvimento/publicação, ainda traz avisos transitivos no
  `npm audit` completo. A dependência crítica `tar` foi sobrescrita para a versão corrigida; não há
  vulnerabilidade no bundle de produção. Monitorar atualizações do CLI.
- Logos e avatares permanecem públicos intencionalmente. Documentos de apresentação são privados.
- Segurança é processo contínuo: revisar advisors, dependências, logs e acessos periodicamente.

## Referências de controle

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Password Security: https://supabase.com/docs/guides/auth/password-security
- Next.js CSP: https://nextjs.org/docs/app/guides/content-security-policy
- OWASP API Security Top 10: https://owasp.org/API-Security/
