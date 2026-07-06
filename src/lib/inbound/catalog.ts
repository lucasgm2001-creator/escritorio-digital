import type { InboundProvider } from './types'

// Catálogo ESTÁTICO dos providers de ENTRADA (INBOUND-001, Part 2). Só metadados — nada conecta, nada
// recebe. Cada provider declara nome, categoria, descrição, autenticação futura, tipo de payload,
// capacidades, se permite teste/replay e o estado visual (sempre "não ativo" hoje).
export const INBOUND_PROVIDERS: InboundProvider[] = [
  {
    key: 'generic', name: 'Webhook genérico', monogram: 'WH', category: 'generic',
    description: 'Endpoint universal para qualquer ferramenta que envie JSON. Você mapeia os campos ao ligar.',
    event: 'generic', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'event', label: 'Eventos' }],
    allowsTest: true, allowsReplay: true, status: 'ready_to_configure',
  },
  {
    key: 'magnetic', name: 'Magnetic Funnels', monogram: 'MF', category: 'form',
    description: 'Funis/formulários (GoHighLevel). Cada lead novo entra no funil do Comercial.',
    event: 'lead', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'form', label: 'Formulário' }, { key: 'utm', label: 'UTM' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'meta_lead_ads', name: 'Meta Lead Ads', monogram: 'M', category: 'ads',
    description: 'Formulários de lead do Facebook/Instagram Ads, com campanha e criativo de origem.',
    event: 'lead', auth: 'hmac_signature', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'campaign', label: 'Campanha' }, { key: 'utm', label: 'UTM' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'typeform', name: 'Typeform', monogram: 'TF', category: 'form',
    description: 'Respostas de formulários Typeform mapeadas para lead.',
    event: 'lead', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'form', label: 'Formulário' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'tally', name: 'Tally', monogram: 'Ta', category: 'form',
    description: 'Submissões de formulários Tally mapeadas para lead.',
    event: 'lead', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'form', label: 'Formulário' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'jotform', name: 'Jotform', monogram: 'JF', category: 'form',
    description: 'Submissões de formulários Jotform mapeadas para lead.',
    event: 'lead', auth: 'secret_token', payloadType: 'form',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'form', label: 'Formulário' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'whatsapp', name: 'WhatsApp', monogram: 'WA', category: 'messaging',
    description: 'Mensagens recebidas que geram lead ou atualizam uma conversa.',
    event: 'message', auth: 'hmac_signature', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'message', label: 'Mensagens' }],
    allowsTest: false, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'make', name: 'Make', monogram: 'Mk', category: 'automation',
    description: 'Cenários do Make que empurram dados normalizados para o Escritório Digital.',
    event: 'generic', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'event', label: 'Eventos' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'n8n', name: 'n8n', monogram: 'N8', category: 'automation',
    description: 'Workflows do n8n que enviam leads/eventos via webhook de entrada.',
    event: 'generic', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'event', label: 'Eventos' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'zapier', name: 'Zapier', monogram: 'Zp', category: 'automation',
    description: 'Zaps que entregam leads/eventos de centenas de apps via webhook.',
    event: 'generic', auth: 'secret_token', payloadType: 'json',
    capabilities: [{ key: 'lead', label: 'Leads' }, { key: 'event', label: 'Eventos' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
  {
    key: 'stripe', name: 'Stripe', monogram: 'S', category: 'payments',
    description: 'Eventos de pagamento/assinatura (invoice, charge, subscription) via webhook assinado.',
    event: 'payment', auth: 'hmac_signature', payloadType: 'json',
    capabilities: [{ key: 'payment', label: 'Pagamentos' }, { key: 'subscription', label: 'Assinaturas' }],
    allowsTest: true, allowsReplay: true, status: 'awaiting_provider',
  },
]
