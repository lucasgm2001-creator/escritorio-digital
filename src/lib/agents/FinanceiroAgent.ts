import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { Payment, AgentAnalysis } from '@/types'

export class FinanceiroAgent {
  private readonly agentId = 'financeiro-agent'
  private readonly agentName = 'Agente Financeiro'

  async analyzePayments(payments: Payment[]): Promise<AgentAnalysis> {
    const receitas = payments.filter(p => p.type === 'receita').reduce((sum, p) => sum + p.amount, 0)
    const despesas = payments.filter(p => p.type === 'despesa').reduce((sum, p) => sum + p.amount, 0)
    const summary = `Receitas: R$${receitas.toFixed(2)} | Despesas: R$${despesas.toFixed(2)} | Saldo: R$${(receitas - despesas).toFixed(2)}`

    // Sanitizar dados sensíveis
    const safePayments = payments.slice(0, 10).map(p => ({
      id: p.id,
      description: (p.description || '').replace(/[\r\n`{}]/g, ' ').slice(0, 100),
      type: (p.type || '').replace(/[\r\n`{}]/g, ' '),
      amount: Math.max(0, p.amount || 0),
      status: (p.status || '').replace(/[\r\n`{}]/g, ' '),
    }))

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: 'Você é um analista financeiro. Analise fluxos de caixa e forneça insights estratégicos. Responda em português.',
      messages: [
        {
          role: 'user',
          content: `Analise este fluxo financeiro: Receitas: R$${receitas.toFixed(2)}, Despesas: R$${despesas.toFixed(2)}, Saldo: R$${(receitas - despesas).toFixed(2)}. Dados detalhados: ${JSON.stringify(safePayments)}. Forneça 3 insights e 3 recomendações.`,
        },
      ],
      maxOutputTokens: 500,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'payment_analysis',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      data: { receitas, despesas, saldo: receitas - despesas },
      createdAt: new Date().toISOString(),
    }
  }

  getOverduePayments(payments: Payment[]): Payment[] {
    const today = new Date()
    return payments.filter(p => p.status === 'pendente' && new Date(p.due_date) < today)
  }

  getMonthlyBalance(payments: Payment[]): { receitas: number; despesas: number; saldo: number } {
    const receitas = payments.filter(p => p.type === 'receita' && p.status === 'pago').reduce((sum, p) => sum + p.amount, 0)
    const despesas = payments.filter(p => p.type === 'despesa' && p.status === 'pago').reduce((sum, p) => sum + p.amount, 0)
    return { receitas, despesas, saldo: receitas - despesas }
  }
}
