import { NextResponse } from 'next/server'

// STUB de webhook de ENTRADA (INBOUND-001, Part 4) — NÃO implementado de propósito. Não grava no banco, não
// cria lead, não aceita produção real, não expõe segredo, não valida payload real. Responde 501 até haver
// autorização + chave + mapeamento. O webhook REAL de hoje (Magnetic) continua em /api/leads/inbound (INT-001).
// Cobre também /api/inbound/generic (provider = 'generic') via rota dinâmica.
const notImplemented = (provider: string) =>
  NextResponse.json(
    {
      error: 'not_implemented',
      provider,
      message: 'Endpoint de entrada não ativado. Requer autorização, chave e mapeamento (INBOUND-001).',
    },
    { status: 501 },
  )

export async function POST(_req: Request, { params }: { params: { provider: string } }) {
  return notImplemented(params.provider)
}

export async function GET(_req: Request, { params }: { params: { provider: string } }) {
  return notImplemented(params.provider)
}
