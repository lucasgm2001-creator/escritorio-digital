import { NextResponse } from 'next/server'
import { integrationNotImplemented } from '@/server/integrations/errors'
import { integrationJsonError } from '@/server/integrations/http'
import { createRequestId } from '@/server/integrations/logger'
import { requireIntegrationAdmin } from '@/server/integrations/security'
import { AdsIntegrationService } from '@/server/services/AdsIntegrationService'

export const dynamic = 'force-dynamic'

export async function GET() {
  const requestId = createRequestId()
  const logContext = { provider: 'meta_ads' as const, requestId, action: 'status' }

  try {
    const access = await requireIntegrationAdmin('meta_ads')
    return NextResponse.json({
      provider: 'meta_ads',
      teamId: access.teamId,
      enabled: true,
      implemented: false,
      configured: false,
      plannedJobs: AdsIntegrationService.plannedJobs('meta_ads'),
      requestId,
    })
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}

export async function POST() {
  const requestId = createRequestId()
  const logContext = { provider: 'meta_ads' as const, requestId, action: 'credentials.save' }

  try {
    await requireIntegrationAdmin('meta_ads')
    throw integrationNotImplemented('Meta Ads credentials')
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}
