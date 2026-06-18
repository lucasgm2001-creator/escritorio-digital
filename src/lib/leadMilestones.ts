import type { createClient } from '@/lib/supabase/client'
import type { Marco } from '@/lib/funnelStages'

type SupaClient = ReturnType<typeof createClient>

// Upsert idempotente (1x por lead por marco) — on conflict (lead_id, marco) do nothing.
// Best-effort: não lança nem bloqueia o fluxo chamador se falhar.
// O QUE cada estágio conta (interagiu/reuniao/fechou) vem de funnel_stages (ver marcosForSlug).
export async function markMilestones(supabase: SupaClient, leadId: string, marcos: Marco[]): Promise<void> {
  if (!leadId || marcos.length === 0) return
  const rows = marcos.map(marco => ({ lead_id: leadId, marco }))
  await supabase.from('lead_milestones').upsert(rows, { onConflict: 'lead_id,marco', ignoreDuplicates: true })
}
