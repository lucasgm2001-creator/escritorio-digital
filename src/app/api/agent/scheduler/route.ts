import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getSuperAgent } from '@/lib/agents/SuperAgent'

/**
 * Automações do SuperAgent, disparadas por cron. Protegida por CRON_SECRET — NÃO
 * por sessão (um cron não tem cookies de auth). Vercel Cron chama via GET e envia
 * "Authorization: Bearer <CRON_SECRET>"; mantemos POST p/ chamadas manuais/externas.
 *
 * ⚠️ DESLIGADO por padrão: não há vercel.json com `crons` (ver vercel.cron.example.json).
 * Antes de ativar: setar CRON_SECRET no ambiente da Vercel e adicionar a entrada em vercel.json.
 * O client já usa SERVICE_ROLE (cron não tem sessão; sem isso o RLS bloquearia as queries/inserts).
 */

export const runtime = 'nodejs'
export const maxDuration = 60

// Comparação em tempo constante. O sha256 garante buffers de mesmo tamanho
// (timingSafeEqual lança quando diferem) e não vaza o comprimento.
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  )
}

// Valida o CRON_SECRET via header `x-cron-secret` OU `Authorization: Bearer`.
// Secret ausente/vazio NÃO autentica.
function authorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const provided =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return !!cronSecret && !!provided && secretsMatch(provided, cronSecret)
}

async function runScheduler() {
  // Cron não tem sessão → SERVICE_ROLE (fura RLS). Server-side only; a chave nunca vai ao browser.
  const supabase = createServiceClient()
  const agent = getSuperAgent(supabase)

  const now = new Date()
  const utcHour = now.getUTCHours()
  const utcDay = now.getUTCDay()
  const logs: string[] = []

  // Checagens (a cada execução): leem dados e POSTAM avisos no Hall (não gastam IA).
  logs.push('Verificando pagamentos atrasados...')
  await agent.verificarPagamentosAtrasados()
  logs.push('Verificando leads sem contato...')
  await agent.verificarLeadsSemContato()
  logs.push('Verificando campanhas sem resultado...')
  await agent.verificarCampanhasSemResultado()
  logs.push('Verificando MRR...')
  const mrr = await agent.verificarMRR()
  logs.push(`MRR atual: R$ ${mrr.toFixed(2)}`)

  // Resumo diário (gasta IA — haiku) às 01:00 UTC = 22:00 BRT.
  if (utcHour === 1) {
    logs.push('Gerando resumo diário...')
    const resumo = await agent.gerarResumoDiario()
    await agent.postarNoHall(`📊 Resumo do dia:\n\n${resumo}`, 'info')
  }

  // Relatório semanal (gasta IA — Sonnet) segunda 14:00 UTC = 11:00 BRT.
  if (utcDay === 1 && utcHour === 14) {
    logs.push('Gerando relatório semanal...')
    const relatorio = await agent.gerarRelatorioSemanal()
    await agent.postarNoHall(`📈 Relatório semanal:\n\n${relatorio}`, 'info')
  }

  return { success: true, timestamp: now.toISOString(), logs }
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    return NextResponse.json(await runScheduler())
  } catch (error) {
    console.error('[agent-scheduler] Error:', error)
    return NextResponse.json({ error: 'Erro ao executar automações.' }, { status: 500 })
  }
}

// Vercel Cron dispara GET; POST fica p/ chamadas manuais/externas.
export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
