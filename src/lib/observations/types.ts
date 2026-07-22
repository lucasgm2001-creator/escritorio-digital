export type ObservationEntityType = 'lead' | 'client'

export type EntityObservation = {
  id: string
  entityType: ObservationEntityType
  entityId: string
  body: string
  sourceType: string
  sourceLabel: string | null
  authorId: string | null
  authorName: string | null
  createdAt: string
  updatedAt: string
  editedAt: string | null
}
