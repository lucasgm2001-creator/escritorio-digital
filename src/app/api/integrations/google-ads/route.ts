import { IntegrationError, integrationNotImplemented } from '@/server/integrations/errors'
import { integrationJsonError } from '@/server/integrations/http'
import { createRequestId } from '@/server/integrations/logger'
import { createOAuthState } from '@/server/integrations/oauth-state'
import { requireIntegrationAdmin } from '@/server/integrations/security'

export const dynamic = 'force-dynamic'

export async function GET() {
  const requestId = createRequestId()
  const logContext = { provider: 'google_ads' as const, requestId, action: 'oauth.start' }

  try {
    const access = await requireIntegrationAdmin('google_ads')
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new IntegrationError('missing_configuration', 'OAuth do Google Ads não está configurado.', 500)
    }
    createOAuthState({
      provider: 'google_ads',
      teamId: access.teamId,
      userId: access.context.user.id,
    })
    throw integrationNotImplemented('Google Ads OAuth')
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}
