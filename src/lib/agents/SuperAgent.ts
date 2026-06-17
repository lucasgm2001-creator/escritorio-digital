import { generateText, tool, jsonSchema } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { createClient } from '@/lib/supabase/server'

// Client supabase do REQUEST atual (server, ligado à sessão/cookies correntes).
type SupaClient = ReturnType<typeof createClient>

// Modelo das ações: sonnet decide ferramentas com mais confiabilidade que haiku.
// IMPORTANTE: tem que ser um modelo HABILITADO na conta — claude-3-5-sonnet-20241022
// devolvia 404 not_found aqui. claude-sonnet-4-6 está disponível e faz tool use ok.
const ACTION_MODEL = 'claude-sonnet-4-6'

// Ferramentas que o agente PODE executar (fase 1: criar lead, criar tarefa).
// SEM `execute`: a chamada é devolvida ao app, que pede confirmação ao usuário
// ANTES de tocar o banco. O modelo só decide A ação e os parâmetros.
const createLeadTool = tool({
  description:
    'Cria um novo lead no funil comercial. Use quando o usuário pedir para criar, cadastrar ou adicionar um lead/contato. Apenas o nome é obrigatório.',
  inputSchema: jsonSchema<{
    name: string; company?: string; phone?: string; niche?: string; value_estimated?: number; notes?: string
  }>({
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do lead (obrigatório); pode ser só o primeiro nome.' },
      company: { type: 'string', description: 'Empresa do lead.' },
      phone: { type: 'string', description: 'Telefone do lead.' },
      niche: { type: 'string', description: 'Nicho ou segmento de atuação.' },
      value_estimated: { type: 'number', description: 'Valor estimado da venda, em dólares (US$).' },
      notes: { type: 'string', description: 'Observações livres sobre o lead.' },
    },
    required: ['name'],
    additionalProperties: false,
  }),
})

const createTaskTool = tool({
  description:
    'Cria uma nova tarefa/lembrete. Use quando o usuário pedir para criar, agendar ou lembrar de uma tarefa/compromisso. Apenas o título é obrigatório.',
  inputSchema: jsonSchema<{
    title: string; due_date?: string; due_time?: string; linked_lead_name?: string
  }>({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título curto e imperativo da tarefa (ex: "Ligar pro João").' },
      due_date: { type: 'string', description: 'Data no formato YYYY-MM-DD (resolva datas relativas a partir de hoje).' },
      due_time: { type: 'string', description: 'Hora no formato HH:MM (24h). Só faz sentido junto com due_date.' },
      linked_lead_name: { type: 'string', description: 'Nome de um lead existente para vincular a tarefa, se o usuário mencionar.' },
    },
    required: ['title'],
    additionalProperties: false,
  }),
})

const moverLeadTool = tool({
  description:
    'Move um lead para outro estágio do funil comercial. Use quando o usuário pedir para mover, avançar ou mudar um lead de fase (ex: "move o Sandro pra reunião", "o João fechou").',
  inputSchema: jsonSchema<{ lead_name: string; destino: string }>({
    type: 'object',
    properties: {
      lead_name: { type: 'string', description: 'Nome do lead a mover.' },
      destino: {
        type: 'string',
        enum: ['novo', 'interagiu', 'nao_interagiu', 'reuniao', 'no_show', 'reagendamento', 'proposta', 'fechado', 'perdido', 'lixeira'],
        description: 'Estágio de destino (código). Mapeie a linguagem natural: "reunião"/"reunião agendada"→reuniao; "no show"/"não compareceu"→no_show; "reagendar"→reagendamento; "proposta"/"proposta em análise"→proposta; "venda fechada"/"fechou"/"ganhou"→fechado; "perdido"/"perdeu"→perdido; "lixo"/"descartar"→lixeira; "interagiu"→interagiu; "não interagiu"/"sem interação"→nao_interagiu; "novo"/"novo lead"→novo.',
      },
    },
    required: ['lead_name', 'destino'],
    additionalProperties: false,
  }),
})

// Texto do preview mostrado ao usuário antes de confirmar a gravação.
function buildActionPreview(toolName: string, p: Record<string, unknown>): string {
  if (toolName === 'create_lead') {
    const lines = ['Vou criar o **lead**:', `- Nome: ${p.name}`]
    if (p.company) lines.push(`- Empresa: ${p.company}`)
    if (p.phone) lines.push(`- Telefone: ${p.phone}`)
    if (p.niche) lines.push(`- Nicho: ${p.niche}`)
    if (p.value_estimated != null) lines.push(`- Valor estimado: US$ ${p.value_estimated}`)
    if (p.notes) lines.push(`- Notas: ${p.notes}`)
    lines.push('', 'Confirma?')
    return lines.join('\n')
  }
  if (toolName === 'create_task') {
    const lines = ['Vou criar a **tarefa**:', `- Título: ${p.title}`]
    if (p.due_date) {
      const quando = p.due_time ? `${p.due_date} às ${p.due_time}` : String(p.due_date)
      lines.push(`- Quando: ${quando}`)
    }
    if (p.linked_lead_name) lines.push(`- Vincular ao lead: ${p.linked_lead_name}`)
    lines.push('', 'Confirma?')
    return lines.join('\n')
  }
  if (toolName === 'mover_lead') {
    // Só chega aqui quando precisa confirmar (destino = Venda Fechada).
    return `Mover **${p.lead_name}** para **Venda Fechada** vai registrar a comissão (deal de US$ 100, 1ª semana paga). Confirma?`
  }
  return 'Confirma?'
}

// Quais ações exigem confirmação antes de executar. Mover é direto, EXCETO pra
// "fechado" (Venda Fechada), que dispara a comissão. Criar lead/tarefa sempre confirmam.
function needsConfirm(toolName: string, p: Record<string, unknown>): boolean {
  if (toolName === 'mover_lead') return p.destino === 'fechado'
  return true
}

export type AgentTurn =
  | { type: 'text'; resposta: string }
  | { type: 'action'; tool: string; params: Record<string, unknown>; requiresConfirm: boolean; resposta: string }

export class SuperAgent {
  // Recebe o supabase do request atual (não cria o seu próprio): garante que
  // leituras/escritas usem a sessão/cookies do request corrente, não de um antigo.
  constructor(private supabase: SupaClient) {}

  private async generateAIResponse(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number = 400,
    model: 'haiku' | 'sonnet' = 'haiku'
  ): Promise<string> {
    const modelId = model === 'sonnet'
      ? 'claude-3-5-sonnet-20241022'
      : 'claude-haiku-4-5-20251001'

    const { text } = await generateText({
      model: anthropic(modelId),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      maxOutputTokens: maxTokens,
    })

    return text
  }

  // Dados disponíveis para o agente analisar
  async getContextData() {
    const [
      { data: leads },
      { data: clients },
      { data: payments },
      { data: campaigns },
    ] = await Promise.all([
      this.supabase.from('leads').select('*').limit(20),
      this.supabase.from('clients').select('*').limit(20),
      this.supabase.from('payments').select('*').limit(20),
      this.supabase.from('campaigns').select('*').limit(10),
    ])

    return {
      leads: leads || [],
      clients: clients || [],
      payments: payments || [],
      campaigns: campaigns || [],
    }
  }

  // Chat interativo com o agente
  async chat(userQuestion: string, userId: string, userRole: string = 'admin'): Promise<string> {
    const context = await this.getContextData()

    // Filtrar dados pelo role do usuário
    let filteredContext = { ...context }
    if (userRole === 'comercial') {
      // Comercial só vê leads e seus próprios clientes
      filteredContext = { leads: context.leads, clients: context.clients, payments: [], campaigns: [] }
    } else if (userRole === 'financeiro') {
      // Financeiro só vê pagamentos
      filteredContext = { leads: [], clients: context.clients, payments: context.payments, campaigns: [] }
    } else if (userRole === 'trafego') {
      // Tráfego só vê campanhas e leads
      filteredContext = { leads: context.leads, clients: [], payments: [], campaigns: context.campaigns }
    }

    return this.generateAIResponse(
      `Você é um assistente inteligente do Escritório Digital DR Growth. Você ajuda a equipe respondendo perguntas sobre leads, clientes, pagamentos e campanhas. Seja conciso, prático e orientado a ações. Responda em português.`,
      `Dados disponíveis:\n${JSON.stringify(filteredContext, null, 2)}\n\nPergunta do usuário (${userRole}): ${userQuestion}`,
      400,
      'haiku'
    )
  }

  // Chat COM ações (tool use). Recebe o histórico da conversa e devolve OU um texto
  // (perguntas/consultas) OU uma ação pendente (create_lead / create_task) com os
  // parâmetros decididos pelo modelo. NÃO grava nada: o app confirma antes de executar.
  async chatWithActions(
    messages: { role: 'user' | 'assistant'; content: string }[],
    opts: { today: string; todayLabel: string },
  ): Promise<AgentTurn> {
    const context = await this.getContextData()
    const system = [
      'Você é o assistente do Escritório Digital DR Growth. Responda em português, de forma concisa e prática.',
      `Hoje é ${opts.todayLabel} (${opts.today}). Resolva datas relativas (hoje, amanhã, depois de amanhã, sexta, segunda, semana que vem) para datas absolutas no formato YYYY-MM-DD a partir de hoje. Se o dia da semana já passou nesta semana, use a próxima ocorrência.`,
      'Você PODE executar ações pelas ferramentas: create_lead (criar lead), create_task (criar tarefa) e mover_lead (mover um lead de estágio no funil). Use a ferramenta correspondente quando o usuário pedir para criar/cadastrar/adicionar/agendar/mover/avançar. Para perguntas, consultas e análises, responda em texto, sem ferramenta.',
      'Nunca diga que já criou algo: ao chamar uma ferramenta, o aplicativo ainda vai pedir a confirmação do usuário antes de gravar.',
      'Se faltar um dado obrigatório (nome do lead, ou título da tarefa), peça-o em texto antes de usar a ferramenta.',
      'Dados atuais do sistema (somente leitura, use apenas para responder perguntas):',
      JSON.stringify(context),
    ].join('\n')

    const result = await generateText({
      model: anthropic(ACTION_MODEL),
      system,
      messages,
      tools: { create_lead: createLeadTool, create_task: createTaskTool, mover_lead: moverLeadTool },
      maxOutputTokens: 600,
    })

    const call = result.toolCalls?.[0]
    if (call) {
      const params = (call.input ?? {}) as Record<string, unknown>
      return { type: 'action', tool: call.toolName, params, requiresConfirm: needsConfirm(call.toolName, params), resposta: buildActionPreview(call.toolName, params) }
    }
    return { type: 'text', resposta: result.text?.trim() || 'Não entendi. Pode reformular?' }
  }

  // Gerar relatório semanal completo (para Daniel/admin)
  async gerarRelatorioSemanal(): Promise<string> {
    const context = await this.getContextData()

    return this.generateAIResponse(
      'Você é um analista de negócios da DR Growth. Gere um relatório executivo semanal em português com: 1) Resumo de resultados, 2) Principais KPIs, 3) Pontos de atenção, 4) Recomendações.',
      `Dados da semana:\n${JSON.stringify(context, null, 2)}`,
      800,
      'sonnet'
    )
  }

  // Gerar resumo diário
  async gerarResumoDiario(): Promise<string> {
    const context = await this.getContextData()

    return this.generateAIResponse(
      'Gere um resumo diário conciso em português com: leads novos, vendas, pagamentos recebidos, alertas urgentes.',
      `Dados de hoje:\n${JSON.stringify(context, null, 2)}`,
      300,
      'haiku'
    )
  }

  // Postar mensagem no Hall
  async postarNoHall(mensagem: string, tipo: 'info' | 'alert' | 'success' | 'warning' = 'info') {
    const { error } = await this.supabase.from('activities').insert({
      type: 'system',
      description: mensagem,
      user_name: 'Sistema',
      metadata: { notification_type: tipo },
    })

    if (error) console.error('Erro ao postar no Hall:', error)
  }

  // Criar cliente automaticamente a partir de lead
  async criarClienteDoLead(lead: { name: string; company?: string; email?: string; phone?: string; assigned_name?: string }) {
    const { data, error } = await this.supabase.from('clients').insert({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      plan_weekly: 140,
      status: 'ativo',
      start_date: new Date().toISOString().slice(0, 10),
      assigned_name: lead.assigned_name || 'Sistema',
    }).select().single()

    if (error) {
      console.error('Erro ao criar cliente do lead:', error)
      await this.postarNoHall(
        `❌ Falha ao criar cliente: ${lead.name}. Tente novamente.`,
        'alert'
      )
      return null
    }

    if (data) {
      await this.postarNoHall(
        `🎉 Novo contrato fechado — ${lead.name}`,
        'success'
      )
    }
    return data
  }

  // Checar pagamentos atrasados
  async verificarPagamentosAtrasados() {
    const { data: pagamentos } = await this.supabase
      .from('payments')
      .select('*')
      .eq('status', 'pendente')
      .lt('due_date', new Date().toISOString().slice(0, 10))

    if (pagamentos && pagamentos.length > 0) {
      await this.postarNoHall(
        `⚠️ ${pagamentos.length} pagamento(s) atrasado(s). Thamyris, favor cobrar!`,
        'warning'
      )
    }
  }

  // Checar MRR
  async verificarMRR() {
    const { data: clients } = await this.supabase
      .from('clients')
      .select('plan_weekly')
      .eq('status', 'ativo')

    const mrr = (clients || []).reduce((sum, c) => sum + (c.plan_weekly * 4), 0)

    if (mrr < 10000) {
      await this.postarNoHall(
        `📉 MRR baixo: R$ ${mrr.toFixed(2)}. Daniel, revisar conversões!`,
        'alert'
      )
    }

    return mrr
  }

  // Checar leads sem contato
  async verificarLeadsSemContato() {
    const cincodiasAtras = new Date()
    cincodiasAtras.setDate(cincodiasAtras.getDate() - 5)

    const { data: leads } = await this.supabase
      .from('leads')
      .select('*')
      .eq('status', 'proposta')
      .lt('updated_at', cincodiasAtras.toISOString())

    if (leads && leads.length > 0) {
      const nomes = leads.slice(0, 3).map(l => l.name).join(', ')
      await this.postarNoHall(
        `⏰ ${leads.length} lead(s) sem contato há 5+ dias: ${nomes}...`,
        'warning'
      )
    }
  }

  // Checar campanhas sem resultado
  async verificarCampanhasSemResultado() {
    const setedasAtras = new Date()
    setedasAtras.setDate(setedasAtras.getDate() - 7)

    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('*')
      .lt('created_at', setedasAtras.toISOString())

    const semResultado = (campaigns || []).filter(c => c.leads === 0)

    if (semResultado.length > 0) {
      await this.postarNoHall(
        `🚨 Campanha(s) sem resultado em 7 dias. Gabriel, considere pausar: ${semResultado[0].name}`,
        'alert'
      )
    }
  }
}

// Cria um agente com o supabase do REQUEST atual. NÃO cachear num singleton: um
// client preso ao 1º request usaria cookies/sessão velhos nas requisições seguintes.
export function getSuperAgent(supabase: SupaClient): SuperAgent {
  return new SuperAgent(supabase)
}
