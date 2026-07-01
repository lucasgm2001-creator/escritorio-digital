# Roadmap Estratégico — Escritório Digital v2

## Visão do Produto

O Escritório Digital deixará de ser uma ferramenta interna da DR Growth para se tornar uma plataforma operacional SaaS.

A arquitetura continuará evoluindo em camadas:

```txt
UI
↓
Request Context
↓
Permission Engine
↓
Services
↓
Repositories
↓
Supabase / APIs externas
```

Enquanto isso, a experiência do usuário evoluirá em paralelo para um produto mobile-first, com aparência e fluidez de aplicativo nativo.

Princípios permanentes:

- Mobile-first (celular > iPad > desktop)
- Evolução incremental
- Nenhuma quebra de produção
- Nenhuma migração arriscada
- Compatibilidade total com integrações atuais
- Um commit por objetivo
- Validação com TypeScript e ESLint em cada etapa

---

# FASE 1 — Mobile-first e Shell

## Objetivo

Transformar toda a navegação em uma experiência de aplicativo.

## Problemas críticos

- Zoom bloqueado (falha de acessibilidade)
- Drawer mobile inacessível
- Botões menores que 44px
- Hover sem equivalente para toque
- Tipografia muito pequena
- Topbar ocupa espaço excessivo
- Ausência de contexto visual da tela
- Scrolls muito longos
- Componentes inconsistentes

## Decisões de produto

- Celular passa a ser a referência oficial de design.
- Desktop será adaptação do mobile.
- Toda nova tela nasce mobile-first.
- Componentes reutilizáveis substituem implementações isoladas.

## Entregas

- Corrigir acessibilidade.
- Corrigir navegação mobile.
- Criar padrão único de botões.
- Criar SegmentedTabs reutilizável.
- Padronizar tipografia.
- Padronizar grids responsivos.
- Melhorar Topbar.
- Melhorar Bottom Navigation.

## Não fazer agora

- Não mudar arquitetura.
- Não criar módulos novos.
- Não alterar banco.
- Não alterar integrações.

---

# FASE 2 — Reorganização dos módulos

## Objetivo

Fazer a estrutura do produto refletir os domínios reais do negócio.

## Problemas atuais

- Financeiro escondido dentro do Comercial.
- Studio implementado dentro do Comercial.
- Agenda presa ao Hall.
- Colaboradores misturados com vendedores.
- Hall concentrando responsabilidades demais.
- Rotas órfãs.
- Código de domínio espalhado.

## Decisões de produto

Separar definitivamente:

- Hall
- Comercial
- Clientes
- Financeiro
- Agenda
- Studio
- Equipe
- Configurações

Hall deixa de ser um "canivete suíço" e passa a ser um dashboard executivo.

Financeiro passa a existir como módulo próprio.

Equipe passa a existir como módulo próprio.

Agenda deixa de ser apenas um componente.

## Não fazer agora

- Não alterar regras de negócio.
- Não alterar integrações.
- Não criar novas funcionalidades.
- Apenas reorganizar responsabilidades.

---

# FASE 3 — Dashboard Executivo

## Objetivo

Transformar o Hall na central operacional do negócio.

## Problemas atuais

- KPIs insuficientes.
- Muito conteúdo secundário.
- Pouca priorização.
- Falta visão gerencial.

## Novo conceito

Quando abrir o sistema, o usuário deve responder imediatamente:

- Como está a empresa?
- O que precisa da minha atenção?
- O que aconteceu hoje?
- Qual vendedor precisa de ajuda?
- Como está o faturamento?
- Como está o funil?

## Entregas

Dashboard executivo com:

- Receita
- Pipeline
- Conversão
- Ticket médio
- Receita prevista
- Receita recebida
- Comissões
- Clientes ativos
- Leads quentes
- Agenda do dia
- Pendências
- Feed inteligente
- Insights da IA

## Não fazer agora

- Não automatizar decisões.
- Não criar IA ativa.
- Apenas consolidar informações.

---

# FASE 4 — SaaS visível na interface

## Objetivo

Fazer a interface refletir a arquitetura multi-tenant já existente.

## Problemas atuais

A infraestrutura já suporta:

- Teams
- Membership
- Active Team
- Permissions
- Request Context

Mas o usuário não percebe isso.

## Decisões

Criar interface para:

- Equipes
- Convites
- Papéis
- Permissões
- Colaboradores
- Administração

## Fluxos

```txt
Guest
↓
Criar equipe
↓
Entrar por convite
↓
Owner
↓
Admin
↓
Member
```

Também nessa fase:

- Troca de equipe
- Convites
- Gestão de membros
- Configuração de colaboradores
- Configuração de remuneração
- Responsáveis por clientes
- Responsáveis por leads

## Não fazer agora

- Não endurecer RLS antes da migração completa.
- Não remover compatibilidade com dados atuais.

---

# FASE 5 — IA, Plataforma e Automações

## Objetivo

Transformar o Escritório Digital em uma plataforma operacional.

## Diretriz permanente

Seguir INT-001.

Integrações existentes permanecem intactas.

- Nada substitui o Magnetic.
- Nada altera Meta Ads.
- Nada altera Make.
- Nada altera webhooks atuais.

Tudo novo será construído paralelamente.

## Grandes pilares

### Integrações

- Meta Ads
- Google Ads
- Google Calendar
- WhatsApp
- Google Business
- APIs externas

### Plataforma

- API própria
- API Keys
- Secret Keys
- Webhooks
- Marketplace
- SDK

### IA

- Copiloto operacional
- Relatórios automáticos
- Análise de campanhas
- Análise financeira
- Recomendações
- Memória por equipe
- Workflow inteligente

### Automações

- Eventos
- Event Bus
- Domain Events
- Outbox
- Workers
- Notificações

### Cliente

Cada cliente passa a possuir um Centro de Integrações.

Cada integração alimenta:

- IA
- Dashboards
- Relatórios
- Automações
- Métricas
- Alertas

---

# O que NÃO fazer agora

- Reescrever integrações existentes.
- Substituir o Magnetic Funnels.
- Alterar fluxo Meta Ads.
- Alterar Make.
- Alterar webhooks atuais.
- Endurecer RLS antes do app estar preparado.
- Misturar reorganização visual com mudanças de regra de negócio.
- Criar funcionalidades grandes em um único commit.

---

# Ordem segura de implementação

1. Mobile-first e Shell.
2. Reorganização dos módulos.
3. Dashboard Executivo.
4. Tornar o SaaS visível na interface (equipes, convites e permissões).
5. Plataforma de Integrações (INT-001).
6. Financeiro moderno.
7. Colaboradores e remuneração configurável.
8. API pública.
9. Event Bus.
10. IA operacional.
11. Marketplace de integrações.
12. Automações inteligentes.

---

# Objetivo final

O Escritório Digital deve evoluir para um sistema operacional empresarial.

Não apenas um CRM.

Não apenas um ERP.

Não apenas um dashboard.

Mas uma plataforma capaz de centralizar pessoas, clientes, vendas, financeiro, integrações, IA e automações em um único ambiente, mantendo arquitetura limpa, evolução incremental e compatibilidade total com a operação existente.
