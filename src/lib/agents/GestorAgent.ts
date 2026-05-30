import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { AgentAnalysis } from '@/types'

export class GestorAgent {
  private readonly agentId = 'gestor-agent'
  private readonly agentName = 'Agente Gestor'

  async generateDailyBriefing(data: {
    leads: number
    revenue: number
    activeCampaigns: number
    pendingTasks: number
  }): Promise<AgentAnalysis> {
    const summary = `Leads: ${data.leads} | Receita: R$${data.revenue.toFixed(2)} | Campanhas: ${data.activeCampaigns} | Tarefas: ${data.pendingTasks}`

    // Validar dados numéricos
    const safeData = {
      leads: Math.max(0, Math.floor(data.leads || 0)),
      revenue: Math.max(0, data.revenue || 0),
      activeCampaigns: Math.max(0, Math.floor(data.activeCampaigns || 0)),
      pendingTasks: Math.max(0, Math.floor(data.pendingTasks || 0)),
    }

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: 'Você é um gestor executivo. Gere briefings diários concisos com pontos de atenção e prioridades. Responda em português.',
      messages: [
        {
          role: 'user',
          content: `Gere um briefing executivo diário: Leads: ${safeData.leads}, Receita: R$${safeData.revenue.toFixed(2)}, Campanhas: ${safeData.activeCampaigns}, Tarefas pendentes: ${safeData.pendingTasks}. Inclua 3 pontos de atenção e 3 prioridades para o dia.`,
        },
      ],
      maxOutputTokens: 400,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'daily_briefing',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      data,
      createdAt: new Date().toISOString(),
    }
  }

  async askQuestion(question: string, context?: string): Promise<string> {
    // Sanitizar inputs do usuário
    const sanitize = (s: string) => (s || '').replace(/[\r\n`{}]/g, ' ').slice(0, 1000)
    const safeQuestion = sanitize(question)
    const safeContext = context ? sanitize(context) : ''

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: 'Você é um assistente gestor de negócios. Responda em português com dados precisos e recomendações práticas.',
      messages: [
        {
          role: 'user',
          content: safeContext
            ? `Contexto do negócio: ${safeContext}\n\nPergunta: ${safeQuestion}`
            : safeQuestion,
        },
      ],
      maxOutputTokens: 600,
    })
    return text
  }
}
