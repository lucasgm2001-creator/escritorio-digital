import { IntegrationError, integrationNotImplemented } from '@/server/integrations/errors'
import { isIntegrationEnabled } from '@/server/integrations/feature-flags'
import { integrationJsonError } from '@/server/integrations/http'
import { createRequestId } from '@/server/integrations/logger'
import { verifyOAuthState } from '@/server/integrations/oauth-state'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const requestId = createRequestId()
  const logContext = { provider: 'google_ads' as const, requestId, action: 'oauth.callback' }

  try {
    if (!isIntegrationEnabled('google_ads')) {
      throw new IntegrationError('integration_disabled', 'Google Ads está desativado por feature flag.', 503)
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = verifyOAuthState(searchParams.get('state'))

    if (state.provider !== 'google_ads') {
      throw new IntegrationError('invalid_state', 'OAuth state não pertence ao Google Ads.', 400)
    }
    if (!code) {
      throw new IntegrationError('invalid_request', 'Código OAuth ausente.', 400)
    }

    throw integrationNotImplemented('Google Ads OAuth token exchange')
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}
