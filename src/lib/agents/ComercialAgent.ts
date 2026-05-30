import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { Lead, AgentAnalysis } from '@/types'

export class ComercialAgent {
  private readonly agentId = 'comercial-agent'
  private readonly agentName = 'Agente Comercial'

  async analyzeLeads(leads: Lead[]): Promise<AgentAnalysis> {
    const summary = `Total: ${leads.length} leads | Fechados: ${leads.filter(l => l.status === 'fechado').length} | Em negociação: ${leads.filter(l => l.status === 'proposta').length}`

    // Sanitizar dados sensíveis
    const safeLeads = leads.slice(0, 10).map(l => ({
      id: l.id,
      name: (l.name || '').replace(/[\r\n`{}]/g, ' ').slice(0, 50),
      company: (l.company || '').replace(/[\r\n`{}]/g, ' ').slice(0, 50),
      score: Math.min(1000, Math.max(0, l.score || 0)),
      status: (l.status || '').replace(/[\r\n`{}]/g, ' '),
      value: l.value || 0,
    }))

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: 'Você é um agente comercial expert. Analise os leads e forneça insights estratégicos. Responda em português com 3 insights e 3 recomendações objetivas.',
      messages: [
        {
          role: 'user',
          content: `Analise estes leads comerciais: ${JSON.stringify(safeLeads)}`,
        },
      ],
      maxOutputTokens: 500,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'lead_analysis',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      createdAt: new Date().toISOString(),
    }
  }

  async suggestFollowUp(lead: Lead): Promise<string> {
    // Sanitizar dados do lead
    const sanitize = (s: string) => (s || '').replace(/[\r\n`{}]/g, ' ').slice(0, 100)
    const safeName = sanitize(lead.name)
    const safeStatus = sanitize(lead.status)

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: 'Você é um assistente comercial. Sugira mensagens de follow-up profissionais e objetivo em português.',
      messages: [
        {
          role: 'user',
          content: `Sugira uma mensagem de follow-up para o lead: ${safeName}, status: ${safeStatus}. Seja breve e objetivo.`,
        },
      ],
      maxOutputTokens: 200,
    })
    return text
  }

  getConversionRate(leads: Lead[]): number {
    if (leads.length === 0) return 0
    return (leads.filter(l => l.status === 'fechado').length / leads.length) * 100
  }
}
