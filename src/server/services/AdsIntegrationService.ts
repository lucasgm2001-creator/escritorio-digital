import { createClient } from '@/lib/supabase/server'
import type { AdsCampaignMetric, TeamAdsCredentials } from '@/types/integrations'
import { integrationNotImplemented } from '@/server/integrations/errors'
import type { HardenedIntegrationProvider } from '@/server/integrations/feature-flags'
import { integrationLog } from '@/server/integrations/logger'

export class AdsIntegrationService {
  /**
   * Obtém as credenciais de integração com APIs de anúncios (Google e Meta) de uma equipe.
   */
  static async getCredentials(teamId: string): Promise<TeamAdsCredentials | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('team_ads_credentials')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    if (error) {
      console.error(`[AdsIntegrationService] Erro ao buscar credenciais para a equipe ${teamId}:`, error.message)
      return null
    }

    return data as TeamAdsCredentials | null
  }

  /**
   * Salvar tokens reais ainda não é permitido. O schema está preparado, mas a ativação depende de
   * criptografia/rotação e OAuth state persistido. Falha fechado para não armazenar secrets em texto puro.
   */
  static async saveCredentials(
    _teamId: string,
    _credentials: Partial<Omit<TeamAdsCredentials, 'id' | 'team_id' | 'created_at' | 'updated_at'>>
  ): Promise<never> {
    void _teamId
    void _credentials
    throw integrationNotImplemented('Ads credentials')
  }

  /**
   * Busca as métricas consolidadas salvas em cache no banco de dados.
   * Usado para renderizar gráficos e dados de campanhas sem consultar APIs externas diretamente.
   */
  static async getCachedMetrics(params: {
    teamId: string
    clientId?: string
    platform?: 'google_ads' | 'meta_ads'
    startDate?: string // YYYY-MM-DD
    endDate?: string   // YYYY-MM-DD
  }): Promise<AdsCampaignMetric[]> {
    const supabase = createClient()
    let query = supabase
      .from('ads_campaign_metrics')
      .select('*')
      .eq('team_id', params.teamId)

    if (params.clientId) {
      query = query.eq('client_id', params.clientId)
    }

    if (params.platform) {
      query = query.eq('platform', params.platform)
    }

    if (params.startDate) {
      query = query.gte('date', params.startDate)
    }

    if (params.endDate) {
      query = query.lte('date', params.endDate)
    }

    const { data, error } = await query.order('date', { ascending: true })

    if (error) {
      console.error('[AdsIntegrationService] Erro ao carregar métricas de anúncios do cache:', error.message)
      return []
    }

    return data as AdsCampaignMetric[]
  }

  /**
   * Sync futuro de contas/campanhas/métricas. Não chama APIs externas e não gera dados fake.
   */
  static async syncPlatformMetrics(teamId: string, provider: HardenedIntegrationProvider): Promise<never> {
    integrationLog('warn', {
      provider,
      teamId,
      action: 'ads.sync',
    }, 'Sync de mídia paga solicitado, mas o conector de produção ainda não está implementado.')
    throw integrationNotImplemented(provider === 'google_ads' ? 'Google Ads' : 'Meta Ads')
  }

  static plannedJobs(provider: Extract<HardenedIntegrationProvider, 'google_ads' | 'meta_ads'>): string[] {
    return provider === 'google_ads'
      ? ['oauth.refresh_token', 'accounts.sync', 'campaigns.sync', 'metrics.cache']
      : ['oauth.refresh_token', 'ad_accounts.sync', 'campaigns.sync', 'metrics.cache']
  }
}
