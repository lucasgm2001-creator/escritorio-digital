# Webhooks de Entrada — arquitetura (INBOUND-001)

A **porta de entrada** do Escritório Digital: como leads e eventos de ferramentas externas entram no
sistema. Esta sprint construiu a **casa** (contratos + UI + docs). Nenhum provider real foi conectado,
nenhuma API externa chamada, nenhum secret criado, nenhum lead criado, nenhum banco alterado.

## O que é "inbound"

Fluxo-alvo (futuro):

```
Ferramenta externa (ex.: Magnetic Funnels)
  → Webhook POST /api/inbound/:provider
  → valida token/assinatura (segurança)
  → normaliza payload externo → InboundLeadPayload
  → cria lead no Comercial (mesmo funil de um lead manual)
  → aparece no Lead Hub e na Timeline
  → gera evento (inbound.lead.created) → IA/Automação depois
```

Hoje já existe **um** webhook real e provider-específico: `/api/leads/inbound` (Magnetic/GoHighLevel). O
inbound genérico **coexiste** com ele e **generaliza** o padrão — nunca o reescreve (INT-001). Quando o
inbound genérico for ativado, o Magnetic pode migrar para ele como mais um provider.

## Contratos (código)

`src/lib/inbound/` — contratos PUROS, provider-agnostic:

- **`types.ts`** — `InboundProvider`, `InboundConnection`, `InboundWebhookEndpoint`, `InboundApiKey`,
  `InboundPayload`, `InboundMapping`, `InboundValidationResult`, `InboundDeliveryLog`,
  `InboundReplayRequest`, `InboundSource`, `InboundLeadPayload`, `InboundSecurityMode/Context`, e as
  interfaces de arquitetura `InboundValidator`/`InboundNormalizer`/`InboundMapper`/`InboundDeliveryLogger`/
  `InboundAdapter`.
- **`catalog.ts`** — os 11 providers preparados (metadados apenas).
- **`events.ts`** — os eventos `inbound.*`.

## Providers preparados (catálogo)

| Provider | Categoria | Entrega | Auth futura | Teste | Replay |
|---|---|---|---|---|---|
| Webhook genérico | Genérico | Lead/Evento | Secret token | ✓ | ✓ |
| Magnetic Funnels | Formulário | Lead | Secret token | ✓ | ✓ |
| Meta Lead Ads | Anúncios | Lead | HMAC | ✓ | ✓ |
| Typeform | Formulário | Lead | Secret token | ✓ | ✓ |
| Tally | Formulário | Lead | Secret token | ✓ | ✓ |
| Jotform | Formulário | Lead | Secret token | ✓ | ✓ |
| WhatsApp | Mensagens | Mensagem/Lead | HMAC | — | ✓ |
| Make | Automação | Genérico | Secret token | ✓ | ✓ |
| n8n | Automação | Genérico | Secret token | ✓ | ✓ |
| Zapier | Automação | Genérico | Secret token | ✓ | ✓ |
| Stripe | Pagamentos | Pagamento | HMAC | ✓ | ✓ |

## Como um provider externo será conectado (futuro)

1. Owner/Admin ativa o provider em **Administração › Webhooks de Entrada** (com autorização).
2. O sistema gera uma **chave/secret** escopada por workspace (só o prefixo público é exibido).
3. A URL `/api/inbound/:provider` é habilitada para aquele workspace/token.
4. Configura-se o **mapeamento** (payload externo → `InboundLeadPayload`).
5. A ferramenta externa passa a enviar `POST` para a URL.

## Padrão de segurança (modelado, não implementado)

`InboundSecurityMode` + `InboundSecurityContext` preparam: **API key**, **secret token**, **HMAC
signature**, **bearer token**, **IP allowlist**, **rate limit**, **replay protection**, **request id**,
**timestamp**, **payload hash** (sha256) e **provider signature**. `InboundValidator.validate()` é o ponto
único onde essas checagens rodarão. Nada disso executa hoje.

## Payload esperado & normalização

Todo provider converte seu payload em **`InboundLeadPayload`** (campos: nome, telefone, email, empresa,
cidade, estado, país, serviço, origem, campanha, formulário, mensagem, utm_source/medium/campaign/content,
raw_payload, received_at, provider, external_id). O `raw_payload` guarda o corpo inteiro — nada se perde.
`InboundLeadPayload` alimentará o `LeadCreateInput` futuro (nenhum lead é criado nesta sprint).

## Logs, replay e eventos (futuro)

- **Logs** (`InboundDeliveryLog`): provider, data, status (`received · validated · rejected · duplicate ·
  created · error · replayed`), motivo, lead vinculado, request id, tempo de processamento.
- **Replay** (`InboundReplayRequest`): reprocessar uma entrega antiga — operação privilegiada.
- **Eventos** (`events.ts`): `inbound.received`, `inbound.validated`, `inbound.rejected`, `inbound.mapped`,
  `inbound.lead.created`, `inbound.duplicate.detected`, `inbound.replay.requested`, `inbound.failed`.

## Endpoints (stubs)

`/api/inbound/[provider]` (+ `/test`, `/replay`) existem como **stubs que respondem 501** (não
implementado). Eles **não** gravam no banco, **não** criam lead, **não** aceitam produção, **não** expõem
segredo. `/api/inbound/generic` resolve via a rota dinâmica (`provider = 'generic'`).

## Como o Magnetic Funnels entraria (exemplo)

Hoje: `/api/leads/inbound` (Magnetic-específico, real). Futuro: Magnetic vira um **provider** do inbound
genérico — `InboundAdapter` com o `InboundMapping` do payload do GoHighLevel (nome→nome, empresa→empresa,
telefone→telefone, etc.), validação por secret token, e a criação de lead passando pelo `InboundNormalizer`.
Comportamento idêntico ao de hoje, só que provider-agnostic e observável (logs/eventos).

## O que ainda depende de autorização

Ativar qualquer provider real, criar secrets/chaves reais, habilitar os endpoints (sair do 501), escrever no
banco (tabelas de connection/endpoint/apikey/deliverylog — ver "não implementado"), e ligar a criação
automática de lead. **Nada disso acontece sem o OK do chefe.**

## O que NÃO foi implementado (de propósito)

- Nenhuma integração real, chamada de API externa, secret real ou env var.
- Nenhum banco/migration/RLS — se a persistência de connections/endpoints/apikeys/logs for necessária,
  será **proposta** como migration separada e **não aplicada sem autorização**.
- Nenhum publisher de eventos (depende do motor de eventos, EVENTS-001).
- Nenhuma criação de lead a partir de fonte externa.
