export const DEFAULT_LEAD_OWNER_ID = '623dd724-ddeb-426c-956a-4c71f6653fa5'
export const DEFAULT_LEAD_OWNER_NAME = 'Lucas'

export function withDefaultLeadOwner<T extends { assigned_to?: unknown; assigned_name?: unknown }>(input: T): T & {
  assigned_to: string | null
  assigned_name: string
} {
  const assignedName = typeof input.assigned_name === 'string' ? input.assigned_name.trim() : ''
  if (assignedName) {
    return {
      ...input,
      assigned_to: typeof input.assigned_to === 'string' && input.assigned_to.trim()
        ? input.assigned_to
        : null,
      assigned_name: assignedName,
    }
  }

  return {
    ...input,
    assigned_to: DEFAULT_LEAD_OWNER_ID,
    assigned_name: DEFAULT_LEAD_OWNER_NAME,
  }
}
