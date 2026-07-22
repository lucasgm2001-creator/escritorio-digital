import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { EntityObservation, ObservationEntityType } from '@/lib/observations/types'

type Row = {
  id: string
  entity_type: ObservationEntityType
  entity_id: string
  body: string
  source_type: string
  source_label: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  edited_at: string | null
}

const mapRow = (row: Row): EntityObservation => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  body: row.body,
  sourceType: row.source_type,
  sourceLabel: row.source_label,
  authorId: row.created_by,
  authorName: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  editedAt: row.edited_at,
})

export async function getEntityObservations(teamId: string, entityType: ObservationEntityType, entityId: string): Promise<EntityObservation[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('entity_observations')
    .select('id, entity_type, entity_id, body, source_type, source_label, created_by, created_by_name, created_at, updated_at, edited_at')
    .eq('team_id', teamId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Row[]).map(mapRow)
}
