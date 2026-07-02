# Roadmap de Produto e UX — Escritório Digital v2

> **Documento mestre e vivo.** Esta é a referência oficial de produto do Escritório Digital v2.
> Toda decisão futura — de UX, arquitetura, banco, integração ou IA — deve ser compatível com este documento.
> Ele evolui junto com o produto: quando a realidade mudar, este arquivo muda antes do código.

- **Status:** vivo (atualizar a cada fase concluída)
- **Base deste documento:** auditoria mobile-first completa (11 superfícies) + diretrizes ARCH-001, UX-001, TEAM-001, INT-001
- **Não é** uma lista de tarefas. É a descrição do produto que estamos construindo e das regras que o governam.

---

## Como ler este documento

1. Comece pela **Visão Final do Produto** — é o destino.
2. Os **Princípios Permanentes** são inegociáveis; valem em todas as fases.
3. As **cinco fases** são o caminho incremental até a visão. Cada fase tem objetivo, problema, impactos, riscos, dependências, critérios de conclusão e limites (o que NÃO fazer).
4. A **Visão Pós-Versão 1.0** são horizontes de longo prazo — direção, não compromisso.

---

## Diretrizes de referência (códigos permanentes)

Estes códigos são citáveis: mencioná-los em qualquer discussão invoca as regras abaixo.

| Código | Nome | Essência |
|---|---|---|
| **ARCH-001** | Arquitetura em camadas | `UI → Request Context → Permission Engine → Services → Repositories → Supabase/APIs externas`. A UI nunca fala direto com o banco. Regra de negócio vive em **Services**; acesso a dados em **Repositories**. |
| **UX-001** | Mobile-first | Celular é a referência oficial de design (celular > iPad > desktop). Sensação de app nativo (tipo Instagram). Desktop é adaptação do mobile, não o contrário. |
| **TEAM-001** | Multi-equipes (multi-tenant) | `Conta → Equipes → Equipe ativa → Dados`. Papéis owner/admin/member; convites por token interno; isolamento por `team_id`. Nunca recriar equipe, nunca trocar `team_id` existente, nunca perder dados. |
| **INT-001** | Plataforma de integrações | O Escritório Digital é o núcleo operacional. Integrações existentes (Magnetic, Meta Ads, Make, webhooks) são **intocáveis**. Toda evolução coexiste antes de migrar. |
| **PRJ-001** | Política de documentação | Pedido de documentação → criar em `/docs` + commit atômico, sem push, sem tocar código/banco/integração. |

> Regra-mãe: **toda funcionalidade deve respeitar ARCH-001, UX-001 e INT-001.** TEAM-001 governa todo dado (sempre com `team_id`).

---

## Visão Final do Produto

O Escritório Digital v2 será o **sistema operacional da empresa**.

Não um CRM. Não um ERP. Não um dashboard. Um **ambiente único** onde a operação inteira acontece: pessoas, clientes, vendas, financeiro, integrações, inteligência artificial e automações convergem para um só núcleo — o dashboard.

Hoje ele é uma ferramenta interna da DR Growth. O destino é uma **plataforma operacional SaaS**, usada por múltiplas empresas, cada uma com sua própria equipe, seus próprios clientes e seu próprio centro de integrações. Cada empresa liga suas fontes (anúncios, WhatsApp, calendário, APIs) e o Escritório Digital passa a **organizar, enriquecer, distribuir e automatizar** essas informações — enquanto uma camada de IA observa tudo e antecipa o que precisa de atenção.

O sucesso não se mede em telas entregues, e sim numa frase: **quando a pessoa abre o Escritório Digital pelo celular, ela entende em segundos como a empresa está e o que fazer a seguir — e o sistema já trabalhou por ela antes de ela chegar.**

É um produto que se sente como um aplicativo, pensa como um gestor e cresce como uma plataforma.

---

## Princípios Permanentes

Valem em todas as fases. Uma decisão que fira um destes princípios está errada por definição.

1. **Mobile-first (UX-001).** Celular é a referência oficial; iPad e desktop são adaptações. Toda tela nova nasce mobile-first.
2. **Arquitetura limpa (ARCH-001).** UI não fala com o banco. Services antes de Repository; Repository antes do Supabase. Regra de negócio nunca mora na UI.
3. **Evolução incremental.** Passos pequenos e reversíveis. Nada de grandes reescritas.
4. **Compatibilidade com produção.** Nenhuma mudança pode quebrar o que já roda — captação de leads, campanhas, comissões, dados reais.
5. **Um commit por objetivo.** Cada commit tem um propósito único, validado com `tsc --noEmit` e `eslint`.
6. **Coexistir antes de substituir.** Nada que funciona é substituído sem antes coexistir com o novo. Primeiro os dois lados convivem; só depois se migra.
7. **Services antes de Repository; Repository antes de Supabase.** A dependência sempre aponta para dentro; nunca a UI ou um Service alcança o Supabase pulando o Repository.
8. **Dados são sagrados.** Nunca recriar equipe, nunca trocar `team_id`, nunca apagar histórico. Migrations aditivas e idempotentes.
9. **Respeito às diretrizes.** Toda funcionalidade respeita ARCH-001, UX-001 e INT-001 — sem exceção.
10. **Documento mestre acima do código.** Quando produto e código divergirem, este documento é a fonte da verdade; o código se ajusta a ele (ou o documento é atualizado conscientemente antes).

---

## Baseline atual (ponto de partida)

Onde o produto está hoje, segundo a auditoria e a arquitetura existente:

- **UX:** fundação mobile boa (BottomNav, bottom-sheets, safe-areas, grids que colapsam, zero tabela de dados), mas com **bolsões de densidade desktop** dentro de telas app-like e defeitos pontuais (zoom bloqueado, drawer morto no mobile, alvos < 44px, tipografia minúscula).
- **Módulos:** domínios acoplados — Financeiro escondido no Comercial, Agenda presa ao Hall, Studio dentro do Comercial, colaboradores misturados com vendedores, rotas órfãs.
- **Arquitetura:** ARCH-001 já iniciada (Request Context, Permission Engine, Services e Repositories de fundação).
- **Multi-tenant (TEAM-001):** infraestrutura existe (teams, membership, active team, permissions) mas **invisível** na interface.
- **Integrações (INT-001):** produção viva via Magnetic → Meta Ads → Make → webhooks. Intocável.

---

# As cinco fases

As fases são incrementais e ordenadas. Cada uma assume as anteriores concluídas, mas nenhuma "termina" de fato — o produto é vivo e volta a cada fase quando necessário.

---

## Fase 1 — Mobile-first e experiência de aplicativo

**Objetivo.** Transformar toda a navegação e o consumo do produto em uma experiência de aplicativo nativo no celular, elevando cada tela ao padrão UX-001.

**Problema que resolve.** Hoje o app tem fundação mobile boa, mas convive com defeitos que quebram a sensação de aplicativo: zoom bloqueado (acessibilidade), drawer inacessível no mobile, ações só-hover invisíveis ao toque, botões abaixo de 44px, tipografia minúscula em informação importante (inclusive dinheiro), Topbar densa sem contexto da tela, scrolls longos sem sub-navegação e componentes inconsistentes reimplementados a cada tela.

**Impacto para o usuário.** O produto passa a parecer e responder como um app: legível na mão, tocável com o dedo, navegável com uma mão, sem zoom travado, sem botão que some. A confiança no uso pelo celular — o dispositivo prioritário — sobe imediatamente.

**Impacto técnico.** Nasce uma **camada de UI compartilhada e consistente**: padrão único de botão/alvo de toque (≥44px), componente `SegmentedTabs` reutilizável, escala tipográfica com piso definido, grids responsivos padronizados (base 1 coluna). Reduz duplicação e dívida visual, e cria o vocabulário de UI que as fases seguintes reaproveitam.

**Riscos.**
- Regressão visual no desktop ao reescrever telas mobile-first (mitigar: desktop é adaptação; validar as duas larguras).
- Reabilitar zoom pode afetar superfícies que dependiam de `NoPinchZoom` (mitigar: restringir o bloqueio a telas específicas, ex.: player de apresentação).
- Padronizar componentes toca muitas telas (mitigar: um componente/uma tela por commit; nunca "big bang").

**Dependências.** UX-001 (diretriz). Nenhuma dependência de banco ou integração. É a **fundação** das demais fases (a reorganização e o dashboard executivo herdam os componentes criados aqui).

**Critérios de conclusão (Definition of Done).**
- Zoom do usuário reabilitado em todo o app (acessibilidade restaurada).
- Nenhuma ação essencial dependente de hover sem equivalente de toque.
- Alvos de toque de ações primárias ≥ 44px; nenhuma informação importante abaixo de `text-xs` (dinheiro ≥ `text-sm`).
- Drawer/Topbar/Bottom Navigation coerentes, com contexto visível da tela ativa.
- `SegmentedTabs`, padrão de botão e grid responsivo existindo como componentes reutilizáveis e adotados nas telas de maior uso.
- `tsc --noEmit` e `eslint` limpos a cada etapa.

**O que NÃO fazer nesta fase.**
- Não mudar a arquitetura (ARCH-001 permanece como está).
- Não criar módulos novos nem mover domínios (isso é Fase 2).
- Não alterar banco, migrations ou integrações.
- Não misturar refatoração visual com mudança de regra de negócio.

---

## Fase 2 — Reorganização dos módulos

**Objetivo.** Fazer a estrutura do produto refletir os **domínios reais do negócio**, separando responsabilidades que hoje estão acopladas.

**Problema que resolve.** Domínios estão misturados: Financeiro vive escondido dentro do Comercial (atrás de um PIN), Agenda é um componente preso ao Hall, Studio está dentro do Comercial, colaboradores se confundem com vendedores, o Hall acumula funções demais e há rotas órfãs. Isso torna o produto difícil de navegar e de evoluir.

**Impacto para o usuário.** Cada coisa passa a ter seu lugar óbvio: Financeiro é Financeiro, Agenda é Agenda, Equipe é Equipe. Menos "onde fica isso?", mais previsibilidade — a mesma clareza que se espera de um app maduro.

**Impacto técnico.** Domínios ganham fronteiras explícitas (rotas/módulos próprios), alinhados a ARCH-001. Código de domínio deixa de estar espalhado; Services e Repositories passam a ser organizados por domínio real, preparando o terreno para o dashboard executivo (Fase 3) e para o SaaS visível (Fase 4).

**Riscos.**
- Mover superfícies pode quebrar links, estado ou permissões (mitigar: mover sem alterar regra; redirecionar rotas antigas; um domínio por commit).
- Tentação de "melhorar de passagem" (mitigar: esta fase **só reorganiza**, não cria feature nem muda regra).

**Dependências.** Fase 1 (componentes de UI consistentes para as telas realocadas). ARCH-001. Não depende de banco novo.

**Critérios de conclusão.**
- Hall, Comercial, Clientes, Financeiro, Agenda, Studio, Equipe e Configurações existem como módulos/domínios distintos.
- Financeiro e Equipe existem como módulos próprios; Agenda deixa de ser apenas um componente do Hall.
- Nenhuma rota órfã; navegação (Sidebar/BottomNav) reflete os domínios reais.
- Comportamento e dados idênticos antes/depois (reorganização sem mudança de regra).

**O que NÃO fazer nesta fase.**
- Não alterar regras de negócio.
- Não alterar integrações.
- Não criar novas funcionalidades — apenas reorganizar responsabilidades.
- Não endurecer permissões/RLS aqui.

---

## Fase 3 — Dashboard executivo

**Objetivo.** Transformar o Hall na **central operacional** do negócio — a tela que responde, em segundos, como a empresa está.

**Problema que resolve.** O Hall hoje é um "canivete suíço" com KPIs insuficientes, muito conteúdo secundário e pouca priorização. Falta a visão gerencial que o dono precisa ao abrir o sistema.

**Impacto para o usuário.** Ao abrir o app, o usuário responde imediatamente: *Como está a empresa? O que precisa da minha atenção? O que aconteceu hoje? Qual vendedor precisa de ajuda? Como está o faturamento? Como está o funil?* O produto deixa de ser "onde eu registro coisas" e vira "onde eu entendo o negócio".

**Impacto técnico.** Surge uma camada de **leitura consolidada** (KPIs, agregações) alimentada por Services/Repositories dos domínios já separados na Fase 2 — sem regra de negócio nova, apenas consolidação e apresentação. Prepara o consumo que a IA (Fase 5) fará depois.

**Riscos.**
- KPIs incorretos minam a confiança (mitigar: cada indicador com fonte rastreável; validar contra dados reais).
- Excesso de informação recria o problema atual (mitigar: priorização é requisito, não enfeite — poucos indicadores certos > muitos).

**Dependências.** Fase 2 (domínios separados fornecem os dados). ARCH-001. Depende de haver métricas confiáveis (funil, receita, comissões) já existentes nos domínios.

**Critérios de conclusão.**
- Dashboard executivo apresentando: receita (prevista e recebida), pipeline, conversão, ticket médio, comissões, clientes ativos, leads quentes, agenda do dia, pendências, feed inteligente e espaço para insights de IA.
- Cada card responde a uma pergunta gerencial clara e prioriza o essencial no mobile.
- Zero decisão automatizada — apenas consolidação e visualização.

**O que NÃO fazer nesta fase.**
- Não automatizar decisões.
- Não criar IA ativa (apenas reservar o espaço para insights).
- Não introduzir novas regras de negócio — apenas consolidar informação existente.

---

## Fase 4 — SaaS visível na interface

**Objetivo.** Fazer a interface **refletir a arquitetura multi-tenant (TEAM-001)** que já existe por baixo, tornando equipes, papéis e permissões visíveis e gerenciáveis.

**Problema que resolve.** A infraestrutura já suporta teams, membership, active team, permissions e request context — mas o usuário não percebe nada disso. O produto é multi-tenant no banco e single-tenant na experiência.

**Impacto para o usuário.** O dono passa a criar equipe, convidar pessoas, definir papéis (owner/admin/member), gerir membros, trocar de equipe e configurar colaboradores e remuneração — tudo pela interface. O onboarding leva o usuário do zero até o primeiro valor. O produto começa a se comportar como um SaaS de verdade.

**Impacto técnico.** A UI passa a exercer o Permission Engine e o Request Context de forma visível: telas de equipe/convite/permissão consomem os Services de TEAM-001. Formaliza os vínculos de responsabilidade (vendedor/colaborador ↔ leads/clientes) preparando o modelo de remuneração configurável.

**Riscos.**
- Mexer em permissões pode expor ou bloquear dados indevidamente (mitigar: TEAM-001 — isolamento por `team_id`; validar cada papel).
- Endurecer RLS cedo demais pode travar dados reais (mitigar: **não** endurecer RLS antes da migração completa; manter compatibilidade com dados atuais).

**Dependências.** Fase 2 (Equipe como módulo próprio). TEAM-001. Infra multi-tenant existente. Modelo de colaboradores/remuneração (fundação já documentada).

**Critérios de conclusão.**
- Fluxo completo visível: Guest → criar equipe / entrar por convite → owner → admin → member.
- Interface para equipes, convites, papéis, permissões, colaboradores e administração.
- Troca de equipe, gestão de membros, configuração de colaboradores e de remuneração operando pela UI.
- Responsáveis por clientes e por leads configuráveis.
- Nenhuma quebra de isolamento; dados atuais preservados.

**O que NÃO fazer nesta fase.**
- Não endurecer RLS antes da migração completa.
- Não remover compatibilidade com os dados atuais.
- Não substituir o modelo atual sem coexistência.

---

## Fase 5 — Plataforma de Integrações + IA

**Objetivo.** Transformar o Escritório Digital em uma **plataforma operacional** aberta: cada cliente com seu Centro de Integrações, alimentando dashboards, relatórios, automações e uma camada de IA — tudo sob INT-001.

**Problema que resolve.** Hoje a informação vem de integrações fixas (Magnetic/Meta/Make/webhooks) e não há forma estruturada de conectar novas fontes, nem de a IA agir sobre elas. Falta a plataforma.

**Impacto para o usuário.** Cada cliente ganha um centro próprio de integrações (Meta Ads, Google Ads, WhatsApp, Google Business, Google Calendar, APIs externas). A IA vira copiloto operacional: relatórios automáticos, análise de campanhas e financeira, recomendações e memória por equipe. O produto passa a trabalhar **por** o usuário.

**Impacto técnico.** Introduz os pilares de plataforma: API própria (API keys/secret keys), webhooks, SDK, marketplace; e os pilares de automação: eventos de domínio, event bus, outbox, workers, notificações. A IA consome a camada de leitura consolidada (Fase 3) e os eventos de domínio. Tudo construído **ao lado** do que existe.

**Riscos (os mais altos do roadmap).**
- Qualquer mudança pode quebrar produção viva (mitigar: **INT-001** — Magnetic/Meta/Make/webhooks intocáveis; construir em paralelo; coexistir antes de migrar).
- Superfície de segurança nova (API keys, webhooks) exige rigor (mitigar: escopo por equipe; TEAM-001; nada exposto sem permissão).
- IA agindo sobre dados errados propaga erro (mitigar: IA começa assistiva/observadora antes de ativa).

**Dependências.** Todas as fases anteriores. INT-001 (diretriz permanente). TEAM-001 (integrações e chaves são por equipe). Dashboard executivo (Fase 3) como consumidor da IA. Em vários casos, **fonte de dados real ainda inexistente** (ex.: Tráfego depende de integração Meta/Google Ads que hoje não alimenta nenhuma tabela) — definir a fonte antes da tela.

**Critérios de conclusão.**
- Centro de Integrações por cliente, com pelo menos uma integração nova coexistindo sem tocar nas atuais.
- API própria com chaves e webhooks, escopados por equipe.
- IA operacional em modo assistivo (relatórios/insights/recomendações) alimentada por eventos e pela leitura consolidada.
- Integrações existentes (Magnetic/Meta/Make/webhooks) **inalteradas e funcionando**.

**O que NÃO fazer nesta fase.**
- Não reescrever nem substituir integrações existentes.
- Não alterar o fluxo Magnetic, Meta Ads, Make ou webhooks atuais.
- Não colocar IA para decidir sozinha antes de ser confiável e observável.
- Não construir plataforma sobre dados que ainda não existem — definir a fonte primeiro.

---

## Ordem segura de implementação

A ordem macro segue as fases; dentro delas, os grandes blocos são entregues nesta sequência de menor risco:

1. Mobile-first e Shell (Fase 1).
2. Reorganização dos módulos (Fase 2).
3. Dashboard executivo (Fase 3).
4. Tornar o SaaS visível na interface — equipes, convites e permissões (Fase 4).
5. Plataforma de Integrações — INT-001 (início da Fase 5).
6. Financeiro moderno (módulo próprio consolidando o que hoje está no Comercial).
7. Colaboradores e remuneração configurável.
8. API pública.
9. Event Bus.
10. IA operacional.
11. Marketplace de integrações.
12. Automações inteligentes.

> Regra de execução: cada item vira vários commits pequenos (um objetivo cada), com `tsc` + `eslint` e sem push sem autorização.

---

## Visão Pós-Versão 1.0

Horizontes de longo prazo. Direção, não compromisso — nada aqui é implementado antes de o produto estar pronto para sustentá-lo.

- **API pública** — terceiros construindo sobre o Escritório Digital.
- **Marketplace de integrações** — catálogo onde cada cliente ativa fontes sob demanda.
- **SDK** — kit para desenvolvedores estenderem a plataforma.
- **IA operacional** — de copiloto assistivo a agente que executa fluxos com supervisão.
- **Event Bus / Domain Events / Outbox / Workers** — espinha dorsal de automação orientada a eventos.
- **Automações inteligentes** — regras e fluxos que reagem a eventos de negócio.
- **Plataforma de integrações** — o Escritório Digital como núcleo que integra, enriquece e distribui dados entre sistemas.
- **Multiempresa** — múltiplas empresas, cada uma multi-equipe, isoladas e escaláveis.
- **Ecossistema** — parceiros, integrações e extensões orbitando a plataforma.

---

## Fora de Escopo

Itens deliberadamente **fora da versão atual** do produto. Estar aqui não significa "nunca" — significa "não agora, e não sem passar por este roadmap". Serve para eliminar ambiguidade e escopo-fantasma.

**Fora do escopo da versão atual (voltam em fases futuras):**

- Módulo **Financeiro** próprio — hoje vive dentro do Comercial; a separação é a Fase 2 e a modernização é o item 6 da ordem segura.
- Tela de **Tráfego/Ads** — não existe e depende de fonte de dados real (Meta/Google Ads) que hoje não alimenta nenhuma tabela. Sem fonte, sem tela.
- **IA ativa/autônoma** que decide ou executa sozinha — na Fase 5 a IA entra apenas assistiva/observadora.
- **Remuneração configurável por colaborador aplicada ao cálculo** — a fundação (tabela) existe, mas adaptar cálculo e UI é etapa própria (FIN-001), fora deste roadmap.
- Migração completa **`assigned_to` → `seller_id`** — em transição; os dois coexistem por compatibilidade.

**Explicitamente proibido nesta fase do produto:**

- Substituir ou reescrever qualquer integração existente — Magnetic, Meta Ads, Make, webhooks (INT-001).
- Endurecer RLS antes de a migração multi-tenant estar completa.
- Reescrita de arquitetura ou mudanças "big-bang".
- Recalcular histórico ou pagamentos passados.
- Misturar reorganização visual com mudança de regra de negócio.

**Pós-Versão 1.0 (só direção, não compromisso):**

- API pública, SDK, Marketplace de integrações, Event Bus, automações inteligentes, multiempresa/ecossistema. Detalhado em "Visão Pós-Versão 1.0".

---

## Decisões Arquiteturais Imutáveis

Regras permanentes do projeto. São **imutáveis**: uma decisão que as contrarie está errada por definição. Consolidam ARCH-001, UX-001, TEAM-001 e INT-001.

1. **Nunca quebrar produção.** O que já roda (captação de leads, campanhas, comissões, dados reais) não pode ser interrompido.
2. **Evolução incremental.** Passos pequenos e reversíveis; nada de grandes reescritas.
3. **Coexistir antes de substituir.** Nada que funciona é removido sem antes conviver com o substituto.
4. **Mobile-first (UX-001).** Celular é a referência; iPad e desktop são adaptações.
5. **Services antes de Repository.** Regra de negócio vive em Services.
6. **Repository antes do Supabase.** Acesso a dados apenas via Repositories.
7. **Nenhuma tela acessa o Supabase diretamente (ARCH-001).** A UI nunca fala com o banco.
8. **Multi-equipes por padrão (TEAM-001).** Todo dado pertence a uma equipe (`team_id`); nunca recriar equipe nem trocar `team_id`; dados nunca são perdidos.
9. **Toda integração segue INT-001.** Construir ao lado; integrações existentes são intocáveis.
10. **Um commit por objetivo.** Cada commit tem propósito único, validado com `tsc --noEmit` e `eslint`.
11. **Push apenas mediante autorização.** Nunca fazer push sem pedido explícito.

---

## Objetivo final

O Escritório Digital v2 deve evoluir para um **sistema operacional empresarial**: não apenas um CRM, não apenas um ERP, não apenas um dashboard — mas uma plataforma capaz de centralizar pessoas, clientes, vendas, financeiro, integrações, IA e automações em um único ambiente, com **arquitetura limpa (ARCH-001), experiência mobile-first (UX-001), multi-tenant (TEAM-001), evolução incremental e compatibilidade total com a operação existente (INT-001).**
