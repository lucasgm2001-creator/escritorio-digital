import { createClient } from '@/lib/supabase/server'
import type { TeamWhatsAppCredentials, WhatsAppMessageLog } from '@/types/integrations'
import { integrationNotImplemented } from '@/server/integrations/errors'
import { integrationLog } from '@/server/integrations/logger'

export class WhatsAppIntegrationService {
  /**
   * Obtém as configurações e credenciais de integração de WhatsApp de uma equipe.
   */
  static async getCredentials(teamId: string): Promise<TeamWhatsAppCredentials | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('team_whatsapp_credentials')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    if (error) {
      console.error(`[WhatsAppIntegrationService] Erro ao buscar credenciais para a equipe ${teamId}:`, error.message)
      return null
    }

    return data as TeamWhatsAppCredentials | null
  }

  /**
   * Salvar tokens reais ainda não é permitido. A infraestrutura está preparada, mas o conector deve ativar
   * criptografia/rotação antes de aceitar secrets.
   */
  static async saveCredentials(
    _teamId: string,
    _credentials: Partial<Omit<TeamWhatsAppCredentials, 'id' | 'team_id' | 'created_at' | 'updated_at'>>
  ): Promise<never> {
    void _teamId
    void _credentials
    throw integrationNotImplemented('WhatsApp credentials')
  }

  /**
   * Envio real ainda não existe. Não grava mensagem fake nem retorna sucesso falso.
   */
  static async sendMessage(params: {
    teamId: string
    clientId: string | null
    toPhone: string
    body: string
  }): Promise<never> {
    integrationLog('warn', {
      provider: 'whatsapp',
      teamId: params.teamId,
      action: 'message.send',
    }, 'Envio de WhatsApp solicitado, mas o conector de produção ainda não está implementado.')
    throw integrationNotImplemented('WhatsApp')
  }

  /**
   * Atualiza o status de uma mensagem recebida de webhook de entrega (delivered, read, failed).
   */
  static async updateMessageStatus(
    messageId: string,
    status: WhatsAppMessageLog['status'],
    errorMessage?: string
  ): Promise<void> {
    const supabase = createClient()
    const now = new Date().toISOString()
    const patch: Partial<WhatsAppMessageLog> = {
      status,
      error_message: errorMessage || null,
    }
    if (status === 'delivered') patch.delivered_at = now
    if (status === 'read') patch.read_at = now
    if (status === 'failed') patch.failed_at = now
    await supabase
      .from('whatsapp_messages_log')
      .update(patch)
      .eq('provider_message_id', messageId)
  }

  /**
   * Grava a mensagem no log interno no banco de dados.
   */
  private static async logMessageLocal(params: {
    teamId: string
    clientId: string | null
    toPhone: string
    direction: 'inbound' | 'outbound'
    status: WhatsAppMessageLog['status']
    body: string
    providerMessageId?: string | null
    errorMessage?: string
  }): Promise<string> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('whatsapp_messages_log')
      .insert({
        team_id: params.teamId,
        client_id: params.clientId,
        to_phone: params.toPhone,
        provider_message_id: params.providerMessageId ?? null,
        direction: params.direction,
        status: params.status,
        body: params.body,
        error_message: params.errorMessage || null,
        sent_at: params.status === 'sent' ? new Date().toISOString() : null
      })
      .select('id')
      .single()

    if (error) {
      console.error('[WhatsAppIntegrationService] Falha ao gravar log de WhatsApp:', error.message)
      throw new Error(`Erro de log: ${error.message}`)
    }

    return data.id
  }
}
