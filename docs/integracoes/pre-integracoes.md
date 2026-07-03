# Pré-integrações — arquitetura de providers (PREINTEGRATION-001)

> Camada **preparada** para integrações futuras (Stripe, Meta Ads, Google Ads, GA4, Search Console,
> TikTok, LinkedIn, WhatsApp, Make, n8n). **Nada conecta nada** ainda: só contratos, catálogo, eventos e
> UI. Uma integração real só é implementada **com autorização explícita**.

## Padrão de provider

Toda integração é um **Provider** que segue o mesmo padrão (`src/lib/integrations/types.ts`):

- **`IntegrationProvider`** — definição estática (catálogo): `key`, `name`, `category`, `capabilities`,
  `scopes` (permissões), `environments`. É o que o provider **é** e o que **precisa**.
- **`IntegrationConnection`** — estado *runtime* de uma conexão para um `IntegrationScope`
  (`{ teamId, clientId? }`): `status`, `environment`, `lastSyncAt`, `externalAccountId`, `health`.
- **`IntegrationStatus`** — `disconnected | connecting | connected | error | expired`.
- **`IntegrationSyncJob` / `IntegrationSyncLog`** — jobs de sincronização e seus logs.
- **`IntegrationWebhookEvent`** — evento cru recebido de um webhook.
- **`ProviderHealth` / `ProviderCapability`** — health-check e capacidades.

O catálogo vive em `src/lib/integrations/catalog.ts` (`INTEGRATION_PROVIDERS` + `integrationsByCategory`).

## Como adicionar uma integração futura

1. **Catálogo** — adicione o provider em `INTEGRATION_PROVIDERS` (key, categoria, capabilities, scopes).
   A UI já o exibe automaticamente (Administração › Integrações, Tráfego › Contas, Cliente › Integrações).
2. **Provider adapter** — crie `src/server/integrations/<provider>/` implementando um contrato comum
   (`connect`, `sync`, `handleWebhook`) — **atrás de autorização**. O domínio (Financeiro/Tráfego) nunca
   importa o SDK do provider direto; fala com o adapter.
3. **Persistência** — quando autorizado, uma migration cria as tabelas de `IntegrationConnection` /
   `IntegrationSyncLog` / webhooks. **Não** antes.
4. **Eventos** — emita os `IntegrationEvent` (abaixo) no Event Bus; Reporting/IA/Automation consomem.

## O que NÃO pode ser feito sem autorização

- Chamar API real (Stripe/Meta/Google/WhatsApp/Make/n8n).
- Criar webhook real, secret, env var ou OAuth app.
- Criar migration/tabela/RLS de integração.
- Gravar tokens/credenciais.

Enquanto não houver autorização, tudo é **visual + contratos**: o botão *Conectar* fica **desativado**.

## Como conectar depois

`Conectar` → fluxo OAuth/API-key do provider → salva `IntegrationConnection` (status `connected`) →
dispara `integration.connected` → primeiro `sync` → dados aparecem nas telas que **já existem** (sem
redesenhar a UI, que lê `IntegrationConnection`/dados normalizados).

## Como eventos devem ser emitidos

Contratos em `src/lib/integrations/events.ts` (`IntegrationEventType`):

```
integration.connected | integration.disconnected | integration.failed
integration.sync.started | integration.sync.completed | integration.sync.failed
integration.webhook.received | integration.webhook.processed | integration.webhook.failed
```

Cada evento carrega `{ provider, scope, at, payload }`. **Sem publisher real nesta fase** — só o contrato.
Pagamentos têm contratos próprios em `src/lib/billing/events.ts` (`payment.*`, `billing.*`).

## Como logs devem funcionar

Cada `IntegrationSyncJob` gera `IntegrationSyncLog[]` (`info|warn|error`). Webhooks recebidos viram
`IntegrationWebhookEvent` (com `processed`). A UI mostrará “últimas sincronizações”, “últimos webhooks”
e “health check” lendo esses registros — hoje exibidos como estados vazios (“Nunca sincronizado”).

## Como evitar acoplamento

- O sistema depende de **`IntegrationProvider`/`IntegrationConnection`**, nunca de um provider específico.
- Stripe é um `PaymentProviderType` entre outros (`asaas`, `mercado_pago`, `paypal`, `manual`) —
  ver `src/lib/billing/types.ts`. O Financeiro lê `CustomerBillingProfile`, não o Stripe.
- UI de conexão é **um** componente: `IntegrationGrid` + `IntegrationProviderCard`
  (`src/components/integrations/`). Não duplicar.
