import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { HardenedIntegrationProvider } from '@/server/integrations/feature-flags'

export type IntegrationAuditOutcome = 'accepted' | 'rejected' | 'failed' | 'blocked'

export type IntegrationAuditEventInput = {
  provider: HardenedIntegrationProvider
  teamId?: string | null
  actorUserId?: string | null
  requestId?: string | null
  correlationId?: string | null
  eventId?: string | null
  action: string
  outcome: IntegrationAuditOutcome
  reason?: string | null
  metadata?: Record<string, unknown>
}

export async function recordIntegrationAuditEvent(input: IntegrationAuditEventInput): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('integration_audit_events').insert({
    provider: input.provider,
    team_id: input.teamId ?? null,
    actor_user_id: input.actorUserId ?? null,
    request_id: input.requestId ?? null,
    correlation_id: input.correlationId ?? null,
    event_id: input.eventId ?? null,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) {
    console.warn('[integration-audit] Falha ao registrar evento de auditoria.', {
      provider: input.provider,
      action: input.action,
      reason: error.message,
    })
  }
}
