# Event Bus — arquitetura (EVENT-001)

A **espinha dorsal de eventos** do Escritório Digital: como os módulos vão conversar sem se acoplar. Esta
sprint criou a **fundação** (contratos + catálogo + Event Center + docs). **Nada** foi implementado de
verdade: nenhum publisher/subscriber, fila, worker, persistência, integração, migration ou alteração de
banco/Services/Repository/API/RLS/regra.

## Por que um Event Bus

Hoje os módulos (Comercial, Clientes, Billing, Inbound, Integrações, IA, Timeline, Dashboard, Notificações)
precisam reagir a acontecimentos uns dos outros — sem se conhecerem diretamente. Um barramento
**provider-agnostic** resolve isso: quem faz algo **publica** um evento; quem se interessa **assina**. Zero
acoplamento, um só ponto de verdade para "o que aconteceu".

```
Módulo A  ──publish──▶  Event Bus (dispatcher)  ──dispatch──▶  Módulo B, C, D (subscribers)
                              │
                              └──▶ Event Log (id, status, duração, erro...)
```

## Contratos (código)

`src/lib/events/` — mesmo padrão de `lib/integrations`, `lib/billing`, `lib/inbound`:

- **`types.ts`** — `EventCategory`, `EventPriority`, `EventType`, `EventSource`, `EventTarget`,
  `EventContext`, `EventMetadata`, `EventPayload`, `DomainEvent`, e os contratos de arquitetura
  `EventPublisher` / `EventSubscriber` / `EventDispatcher` / `EventHandler`. Mais o modelo de log
  `EventLogEntry`/`EventLogStatus`.
- **`catalog.ts`** — o **catálogo único** (`EVENT_CATALOG`) com 20 eventos, categorias e helpers.

### Publisher / Subscriber / Dispatcher

- **Publisher** (`EventPublisher.publish`) — o módulo de origem emite um `DomainEvent`. Não sabe quem ouve.
- **Subscriber** (`EventSubscriber`) — um módulo declara `subscriptions: EventType[]` e recebe os eventos
  correspondentes via `onEvent`.
- **Dispatcher** (`EventDispatcher`) — registra subscribers e entrega cada evento aos interessados. É o único
  que conhece o mapa origem→destino.
- **Handler** (`EventHandler`) — unidade fina que trata um conjunto de `EventType`.

## Catálogo (Parts 3/4)

`EVENT_CATALOG` — nome canônico `categoria.acao`, prioridade, descrição, **origem** e **destinos**:

`lead.created` · `lead.updated` · `lead.deleted` · `lead.moved` · `task.created` · `task.completed` ·
`task.deleted` · `meeting.created` · `meeting.completed` · `client.created` · `client.updated` ·
`payment.confirmed` · `payment.failed` · `payment.refunded` · `integration.connected` ·
`integration.failed` · `webhook.received` · `report.generated` · `notification.created` ·
`ai.summary.created`.

## Event Log (Part 6)

`EventLogEntry` (só modelo, sem persistência): `id`, `eventId`, `type`, `timestamp`, `provider`, `origin`,
`status` (`published · delivered · handled · failed · skipped`), `durationMs`, `payloadHash`, `entity`,
`userId`, `teamId`, `error`.

## Como cada módulo entra (Part 7) — sem alterá-los

- **Inbound** publica `webhook.received` / `lead.created` ao receber um lead externo.
- **Comercial** publica `lead.*` / `client.created`.
- **Billing** publica `payment.confirmed/failed/refunded`.
- **Integrações** publica `integration.connected/failed`.
- **Timeline** **assina** quase tudo (é o histórico unificado).
- **Dashboard** assina os eventos que viram métrica.
- **IA** assina para resumir/alertar; **Notificações** assina para avisar.
- **Automações** (futuro) assinam eventos e disparam ações ("SE evento ENTÃO ação").

Nada disso está ligado — são apenas as **assinaturas previstas** no catálogo (`targets`).

## Boas práticas

- **Nome**: `categoria.acao`, no passado (`lead.created`, não `create.lead`).
- **Payload versionado** (`metadata.version`) — evoluir sem quebrar quem já assina.
- **Idempotência**: subscribers devem tolerar reentrega (o mesmo evento pode chegar 2x no futuro).
- **Sem acoplamento**: publisher nunca importa subscriber; só o dispatcher conhece o mapa.
- **Multi-tenant**: todo evento carrega `context.teamId` (TEAM-001) — subscribers filtram por equipe.

## Como adicionar um novo evento

1. Adicione a definição em `EVENT_CATALOG` (`type`, `category`, `priority`, `description`, `source`,
   `targets`). Ele aparece **automaticamente** no Event Center (Administração › Eventos).
2. Quando o motor existir: o módulo de origem chama `publisher.publish(...)`; os interessados declaram a
   assinatura. Nenhuma mudança nos outros módulos.

## O que NÃO foi implementado (de propósito)

- Nenhum publisher/subscriber/dispatcher **real**; nenhuma fila, worker ou retry.
- Nenhuma **persistência** de eventos/log — se necessária, será **proposta** como migration separada e
  **não aplicada sem autorização**.
- Nenhuma integração real (Stripe/Meta/Magnetic), nenhuma alteração de banco/Services/Repository/API/RLS.
- O Event Center é **estático**: mostra o catálogo e o estado honesto (*nenhum publisher configurado, nenhum
  subscriber ativo, arquitetura preparada, nenhum evento publicado*).
