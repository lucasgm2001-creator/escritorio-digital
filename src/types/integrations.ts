export interface StripeWebhookEvent {
  id: string
  team_id: string | null
  provider: 'stripe'
  event_id: string
  type: string
  data: Record<string, unknown>
  processed: boolean
  error_message: string | null
  request_id: string | null
  correlation_id: string | null
  attempts: number
  next_retry_at: string | null
  created_at: string
}

export interface TeamAdsCredentials {
  id: string
  team_id: string
  google_ads_customer_id: string | null
  google_refresh_token_ciphertext: string | null
  meta_ad_account_id: string | null
  meta_access_token_ciphertext: string | null
  encryption_key_id: string | null
  token_rotated_at: string | null
  created_at: string
  updated_at: string
}

export interface AdsCampaignMetric {
  id: string
  team_id: string
  client_id: string
  platform: 'google_ads' | 'meta_ads'
  campaign_id: string
  campaign_name: string
  status: string | null
  clicks: number
  impressions: number
  ctr: number
  spend: number
  conversions: number
  cpc: number
  date: string // YYYY-MM-DD
  created_at: string
  updated_at: string
}

export interface TeamWhatsAppCredentials {
  id: string
  team_id: string
  phone_number_id: string | null
  waba_id: string | null
  access_token_ciphertext: string | null
  encryption_key_id: string | null
  token_rotated_at: string | null
  provider: 'official_meta' | 'twilio' | 'evolution'
  created_at: string
  updated_at: string
}

export interface WhatsAppMessageLog {
  id: string
  team_id: string
  client_id: string | null
  to_phone: string
  provider_message_id: string | null
  direction: 'inbound' | 'outbound'
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  body: string
  error_message: string | null
  sent_at: string | null
  delivered_at?: string | null
  read_at?: string | null
  failed_at?: string | null
  retry_count?: number
  next_retry_at?: string | null
  created_at: string
}
