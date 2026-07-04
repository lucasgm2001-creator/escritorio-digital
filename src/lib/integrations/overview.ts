import { INTEGRATION_PROVIDERS, DOMAIN_LABELS } from './catalog'
import { rollupHealth } from './health'
import type { IntegrationDomain, IntegrationHealthState } from './types'

// VISÃO GERAL da Central (INT-001). Agregação PURA e HONESTA sobre o catálogo estático — sem banco, sem
// runtime, sem chamada externa. Esta camada ainda não gerencia conexões, então os contadores de runtime
// (gerenciadas aqui / erros / eventos / última sync) são 0/— DE VERDADE. O que já opera hoje (Magnetic e
// Google, via superfícies atuais) é contado como "ativo (atual)" e nomeado — nada é inventado nem inflado.

export type IntegrationOverview = {
  totalProviders: number
  connected: number                             // ativas hoje via superfícies atuais (managedVia != null)
  disconnected: number
  errors: number
  eventsReceived: number                        // event bus não publica ainda → 0
  lastSyncAt: string | null                     // nenhuma sync gerenciada aqui → null
  health: IntegrationHealthState                // rollup sem conexões → 'unknown'
  coexistingProviders: string[]                 // nomes dos que já operam por superfície atual
  byDomain: { domain: IntegrationDomain; label: string; total: number }[]
}

export function getIntegrationOverview(): IntegrationOverview {
  const providers = INTEGRATION_PROVIDERS
  const coexistingProviders = providers.filter(p => p.managedVia != null).map(p => p.name)
  const byDomain = (Object.keys(DOMAIN_LABELS) as IntegrationDomain[]).map(domain => ({
    domain, label: DOMAIN_LABELS[domain], total: providers.filter(p => p.domain === domain).length,
  }))
  return {
    totalProviders: providers.length,
    connected: coexistingProviders.length,
    disconnected: providers.length - coexistingProviders.length,
    errors: 0,
    eventsReceived: 0,
    lastSyncAt: null,
    health: rollupHealth([]),
    coexistingProviders,
    byDomain,
  }
}
